import type {
  Scenario,
  GlobalSettings,
  SimulationResult,
  MonthlySnapshot,
  AnnualSummary,
  LifeEvent,
  InvestmentAccount,
  ChildConfig,
  RetirementConfig,
} from '@/types';
import { calculateAnnualNetIncome, calculateBox3Tax, calculateEigenwoningforfait } from './tax';
import { calculateMonthlyMortgagePayment } from './mortgage';
import { calculatePortfolioMonth, calculateFireNumber, calculateCoastFire } from './investment';
import { calculateAnnualToeslagen } from './toeslagen';

/**
 * Calculate monthly pension based on middelloon (career-average) scheme.
 * Formula: accrualRate × serviceYears × (salary − franchise) × partTimeFactor
 * Early retirement: if pension starts before AOW age, apply actuarial reduction.
 */
export function calculateMiddelloonPension(
  ret: RetirementConfig,
  grossAnnualSalary: number,
): number {
  const accrualRate = ret.pensionAccrualRate ?? 0.01875;
  const franchise = ret.pensionFranchise ?? 17545;
  const serviceStartAge = ret.pensionServiceStartAge ?? 25;
  const partTimeFactor = ret.pensionPartTimeFactor ?? 1.0;
  const earlyPenalty = ret.pensionEarlyRetirementPenalty ?? 0.065;

  // Service years: accrual stops when you stop working (targetAge)
  const serviceYears = Math.max(0, ret.targetAge - serviceStartAge);

  // Pension base = salary minus franchise (floored at 0)
  const pensionBase = Math.max(0, grossAnnualSalary - franchise);

  // Annual pension before early retirement reduction
  const annualPension = accrualRate * serviceYears * pensionBase * partTimeFactor;

  // Early retirement reduction: if pension starts before AOW age
  const yearsEarly = Math.max(0, ret.aowStartAge - ret.pensionStartAge);
  const reduction = yearsEarly * earlyPenalty;
  const adjustedAnnual = annualPension * Math.max(0, 1 - reduction);

  return adjustedAnnual / 12;
}

/**
 * Run the full financial simulation for a scenario
 */
export function runSimulation(scenario: Scenario, settings: GlobalSettings): SimulationResult {
  const dob = new Date(settings.dateOfBirth);
  // Start simulation from January 1st of the current year so the first year is always complete
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
  const startAge = (startDate.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const endAge = settings.simulationEndAge;
  const totalMonths = Math.ceil((endAge - startAge) * 12);

  const { income, tax, expenses, housing, investments, retirement } = scenario;
  const inflationRate = expenses.customInflationRate ?? settings.inflationRate;
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12) - 1;

  // ---- Initial state ----
  let cashBalance = investments.currentSavings;
  const investmentBalances = new Map<string, number>();
  for (const acc of investments.accounts) {
    investmentBalances.set(acc.id, acc.balance);
  }

  // Mortgage state per mortgage (keyed by mortgage id)
  const mortgageBalances = new Map<string, number>();
  const mortgageStartDates = new Map<string, Date>();
  for (const prop of housing.properties) {
    for (const mtg of prop.mortgages) {
      mortgageBalances.set(mtg.id, mtg.principal);
      mortgageStartDates.set(mtg.id, new Date(mtg.startDate));
    }
  }

  // Income state (for merit increases and career events)
  let currentSalary = income.grossSalary;
  let currentPartnerSalary = income.partnerGrossSalary;
  let hasPartner = income.hasPartner;
  const retirementAge = retirement.targetAge;
  const pensionStartAge = retirement.pensionStartAge ?? retirement.targetAge;
  const aowAge = retirement.aowStartAge;
  const fireNumber = calculateFireNumber(retirement.desiredAnnualSpending, retirement.safeWithdrawalRate);

  // Compute pension monthly amount — middelloon estimation or flat
  const pensionMonthly = (retirement.pensionType === 'middelloon')
    ? calculateMiddelloonPension(retirement, income.grossSalary)
    : retirement.pensionMonthlyAmount;

  const months: MonthlySnapshot[] = [];
  const annualData: Map<number, Partial<AnnualSummary> & { mortgageInterest?: number; eigenwoningforfait?: number }> = new Map();

  let fireDate: string | null = null;
  let fireAgeValue: number | null = null;
  let isRetired = false;
  let inflationFactor = 1;

  // Career break state — track when salary should auto-restore
  let careerBreakEndMonth: number | null = null;  // month index when break ends
  let preBreakSalary = currentSalary;
  let preBreakPartnerSalary = currentPartnerSalary;

  // Dynamic children added via life events
  const dynamicChildren: ChildConfig[] = [];

  // Sorted life events
  const sortedEvents = [...scenario.lifeEvents].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let m = 0; m < totalMonths; m++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + m);
    const currentAge = startAge + m / 12;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = currentDate.toISOString().slice(0, 7); // YYYY-MM

    inflationFactor = Math.pow(1 + monthlyInflation, m);

    // ---- Process life events for this month ----
    processLifeEvents(sortedEvents, currentDate, {
      onSalaryChange: (amount, isPartner) => {
        if (isPartner) currentPartnerSalary = amount;
        else currentSalary = amount;
      },
      onPartnerChange: (active) => { hasPartner = active; },
      onLumpSum: (amount) => { cashBalance += amount; },
      onCareerBreak: (durationMonths) => {
        // Save pre-break salaries and schedule restoration
        preBreakSalary = currentSalary;
        preBreakPartnerSalary = currentPartnerSalary;
        careerBreakEndMonth = m + durationMonths;
        currentSalary = 0;
        if (hasPartner) currentPartnerSalary = 0;
      },
      onChildBorn: (monthlyExpense, event) => {
        // Add a child to expenses dynamically
        // Children added via life events use the event amount as monthly expense
        dynamicChildren.push({
          id: `dynamic-child-${event.id}`,
          name: event.label || 'Child',
          birthDate: currentDate.toISOString(),
          monthlyExpense,
          kinderopvangType: 'none',
          kinderopvangHoursPerMonth: 0,
          kinderopvangHourlyRate: 0,
        });
      },
    });

    // ---- Auto-restore salary after career break duration ----
    if (careerBreakEndMonth !== null && m >= careerBreakEndMonth) {
      currentSalary = preBreakSalary;
      if (hasPartner) currentPartnerSalary = preBreakPartnerSalary;
      careerBreakEndMonth = null;
    }

    // ---- Process career events from IncomeConfig ----
    if (!isRetired) {
      for (const ce of income.careerEvents) {
        const ceDate = new Date(ce.date);
        if (ceDate.getFullYear() === currentDate.getFullYear() && ceDate.getMonth() === currentDate.getMonth()) {
          if (ce.isPartner) currentPartnerSalary = ce.newGrossSalary;
          else currentSalary = ce.newGrossSalary;
        }
      }
    }

    // ---- Apply annual merit increase (January) ----
    if (month === 0 && m > 0 && !isRetired) {
      currentSalary *= 1 + income.meritIncreaseRate;
      if (hasPartner) {
        currentPartnerSalary *= 1 + income.partnerMeritIncreaseRate;
      }
    }

    // ---- Check retirement ----
    if (!isRetired && currentAge >= retirementAge) {
      isRetired = true;
    }

    // ---- Income ----
    let monthlyGrossIncome = 0;
    let primaryMonthlyGross = 0;
    let partnerMonthlyGross = 0;
    if (!isRetired) {
      primaryMonthlyGross = currentSalary / 12;
      // Holiday allowance (spread over 12 months for simplicity)
      primaryMonthlyGross += (currentSalary * income.holidayAllowance) / 12;
      // 13th month
      if (income.thirteenthMonth) {
        const thirteenthAmount = income.thirteenthMonthAmount > 0 ? income.thirteenthMonthAmount : currentSalary / 12;
        primaryMonthlyGross += thirteenthAmount / 12; // Spread over year
      }
      // Bonus
      primaryMonthlyGross += income.bonusAmount / 12;

      // Partner income
      if (hasPartner) {
        partnerMonthlyGross += currentPartnerSalary / 12;
        partnerMonthlyGross += (currentPartnerSalary * income.partnerHolidayAllowance) / 12;
        // Partner 13th month
        if (income.partnerThirteenthMonth) {
          partnerMonthlyGross += currentPartnerSalary / 12 / 12;
        }
        // Partner bonus
        partnerMonthlyGross += (income.partnerBonusAmount ?? 0) / 12;
      }

      // Rental income from properties (attributed to primary)
      for (const prop of housing.properties) {
        if (!prop.isOwnerOccupied && prop.rentalIncome > 0) {
          primaryMonthlyGross += prop.rentalIncome;
        }
      }

      // Side income (attributed to primary)
      for (const side of income.sideIncomes) {
        switch (side.frequency) {
          case 'monthly': primaryMonthlyGross += side.grossAmount; break;
          case 'quarterly': primaryMonthlyGross += side.grossAmount / 3; break;
          case 'annual': primaryMonthlyGross += side.grossAmount / 12; break;
        }
      }

      monthlyGrossIncome = primaryMonthlyGross + partnerMonthlyGross;
    } else {
      // Retirement income
      if (currentAge >= aowAge) {
        primaryMonthlyGross += retirement.aowMonthlyAmount;
        if (hasPartner && currentAge >= aowAge) {
          partnerMonthlyGross += retirement.aowMonthlyAmount * 0.7; // Partner AOW estimate
        }
      }
      if (currentAge >= pensionStartAge) {
        primaryMonthlyGross += pensionMonthly;
      }
      monthlyGrossIncome = primaryMonthlyGross + partnerMonthlyGross;
    }

    // ---- Expenses (inflation-adjusted) ----
    let monthlyExpenses = 0;

    // Fixed monthly
    for (const item of expenses.monthlyFixed) {
      monthlyExpenses += item.amount * inflationFactor;
    }
    // Variable monthly
    for (const item of expenses.monthlyVariable) {
      monthlyExpenses += item.amount * inflationFactor;
    }
    // Annual (spread monthly)
    for (const item of expenses.annualExpenses) {
      monthlyExpenses += (item.amount / 12) * inflationFactor;
    }
    // Healthcare
    monthlyExpenses += expenses.healthcareMonthlyPremium * inflationFactor;
    monthlyExpenses += (expenses.healthcareDeductible / 12) * inflationFactor;
    // Partner healthcare (only when partner is active)
    if (hasPartner) {
      monthlyExpenses += (expenses.partnerHealthcareMonthlyPremium ?? 0) * inflationFactor;
      monthlyExpenses += ((expenses.partnerHealthcareDeductible ?? 0) / 12) * inflationFactor;
    }

    // Children (from config + dynamic from life events)
    const allChildren = [...expenses.children, ...dynamicChildren];
    for (const child of allChildren) {
      const childBirth = new Date(child.birthDate);
      const childAge = (currentDate.getTime() - childBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (childAge >= 0 && childAge < 23) {
        // Cost curve: 100% until 4, 120% from 4-12, 150% from 12-18, 80% from 18-23
        let factor = 1;
        if (childAge >= 4 && childAge < 12) factor = 1.2;
        else if (childAge >= 12 && childAge < 18) factor = 1.5;
        else if (childAge >= 18) factor = 0.8;
        monthlyExpenses += child.monthlyExpense * factor * inflationFactor;
      }

      // Kinderopvang costs (gross cost — toeslag is added as income)
      const kinderopvangType = child.kinderopvangType ?? 'none';
      if (kinderopvangType !== 'none') {
        const hours = child.kinderopvangHoursPerMonth ?? 0;
        const rate = child.kinderopvangHourlyRate ?? 0;
        // Only charge during eligible ages
        const isEligible =
          (kinderopvangType === 'bso' && childAge >= 4 && childAge < 13) ||
          ((kinderopvangType === 'daycare' || kinderopvangType === 'gastouder') && childAge >= 0 && childAge < 13);

        // Check user-defined start/end date window (YYYY-MM)
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const afterStart = !child.kinderopvangStartDate || monthKey >= child.kinderopvangStartDate;
        const beforeEnd = !child.kinderopvangEndDate || monthKey <= child.kinderopvangEndDate;

        if (isEligible && afterStart && beforeEnd) {
          monthlyExpenses += hours * rate * inflationFactor;
        }
      }
    }

    // One-off expenses
    for (const oneOff of expenses.oneOffExpenses) {
      const eventDate = new Date(oneOff.date);
      if (
        eventDate.getFullYear() === currentDate.getFullYear() &&
        eventDate.getMonth() === currentDate.getMonth()
      ) {
        monthlyExpenses += oneOff.amount;
      }
    }

    // ---- Mortgage ----
    let totalMortgagePayment = 0;
    let totalMortgageInterest = 0;
    let totalDeductibleMortgageInterest = 0;
    let totalMortgagePrincipal = 0;
    let totalMortgageBalance = 0;
    let totalPropertyValue = 0;
    let totalWozValue = 0;
    // Box 3 tracking: only non-owner-occupied properties & their mortgages
    let box3PropertyValue = 0;
    let box3MortgageDebt = 0;

    for (const prop of housing.properties) {
      // Process each mortgage on this property
      for (const mtg of prop.mortgages) {
        const balance = mortgageBalances.get(mtg.id) ?? 0;
        const startDt = mortgageStartDates.get(mtg.id) ?? new Date();
        const elapsedMonths = (currentDate.getFullYear() - startDt.getFullYear()) * 12 +
          (currentDate.getMonth() - startDt.getMonth());

        // Skip if mortgage hasn't started yet
        if (elapsedMonths < 0) {
          totalMortgageBalance += balance;
          continue;
        }

        const totalMortgageMonths = mtg.termYears * 12;
        const remaining = totalMortgageMonths - elapsedMonths;

        const yearsElapsed = elapsedMonths / 12;
        const baseRate = yearsElapsed < mtg.fixedRatePeriod
          ? mtg.interestRate
          : mtg.variableRateAfter;
        // NHG gives a rate discount (typically ~0.6%) during the fixed period
        const NHG_DISCOUNT = 0.006;
        const rate = mtg.nhg ? Math.max(0, baseRate - NHG_DISCOUNT) : baseRate;

        if (balance > 0 && remaining > 0) {
          const { payment, interest, principal } = calculateMonthlyMortgagePayment(
            mtg.type, balance, rate, remaining
          );

          // Extra repayments
          let extraPrincipal = 0;
          for (const rep of mtg.extraRepayments) {
            const repDate = new Date(rep.date);
            if (repDate.getFullYear() === currentDate.getFullYear() && repDate.getMonth() === currentDate.getMonth()) {
              extraPrincipal += rep.amount;
            }
          }

          const actualPrincipal = Math.min(principal + extraPrincipal, balance);
          mortgageBalances.set(mtg.id, Math.max(0, balance - actualPrincipal));

          totalMortgagePayment += payment + extraPrincipal;
          totalMortgageInterest += interest;
          totalMortgagePrincipal += actualPrincipal;

          // 30-year deductibility clock: only deductible for owner-occupied if < 360 months since deductibilityStartDate
          if (prop.isOwnerOccupied) {
            const dedStartStr = mtg.deductibilityStartDate || mtg.startDate;
            const dedStart = new Date(dedStartStr);
            const dedElapsed = (currentDate.getFullYear() - dedStart.getFullYear()) * 12 +
              (currentDate.getMonth() - dedStart.getMonth());
            if (dedElapsed < 360) {
              totalDeductibleMortgageInterest += interest;
            }
          }
        }

        totalMortgageBalance += mortgageBalances.get(mtg.id) ?? 0;
      }

      // Property appreciation
      const yearsFromStart = m / 12;
      const currentPropertyValue = prop.value * Math.pow(1 + prop.appreciationRate, yearsFromStart);
      totalPropertyValue += currentPropertyValue;
      totalWozValue += prop.wozValue * Math.pow(1 + prop.appreciationRate, yearsFromStart);

      // Box 3: non-owner-occupied property values + mortgage debts
      if (!prop.isOwnerOccupied) {
        box3PropertyValue += currentPropertyValue;
        for (const mtg of prop.mortgages) {
          box3MortgageDebt += mortgageBalances.get(mtg.id) ?? 0;
        }
      }
    }

    // ---- Tax (simplified monthly: apply annual rate / 12) ----
    const annualGrossIncome = monthlyGrossIncome * 12;
    const annualPrimaryGross = primaryMonthlyGross * 12;
    const annualPartnerGross = partnerMonthlyGross * 12;
    const annualMortgageInterest = totalDeductibleMortgageInterest * 12;
    const ewf = housing.properties.reduce(
      (sum, p) => sum + (p.isOwnerOccupied ? calculateEigenwoningforfait(p.wozValue, tax) : 0), 0
    );

    // Determine eligibility for additional heffingskortingen
    const hasChildUnder12 = allChildren.some((c) => {
      const childBirth = new Date(c.birthDate);
      const childAge = (currentDate.getTime() - childBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return childAge >= 0 && childAge < 12;
    });
    const isAOWAge = currentAge >= retirement.aowStartAge;
    const isSingle = !hasPartner;

    // Partner income splitting: when filing as couple, calculate tax for each partner separately
    let monthlyNetIncome: number;
    if (hasPartner && tax.filingType === 'couple') {
      // Primary: gets mortgage deduction, EWF, self-employment, box2
      const primaryTax = calculateAnnualNetIncome(annualPrimaryGross, annualMortgageInterest, ewf, tax, {
        hasChildUnder12,
        isAOWAge,
        isSingle: false,
        isJonggehandicapt: tax.jonggehandicaptEnabled,
        currentYear: year,
        box2Income: income.box2Income ?? 0,
        hasSelfEmployment: income.sideIncomes.some((si) => si.isSelfEmployed),
      });
      // Partner: own bracket calculation, no mortgage/EWF deductions (assigned to primary)
      const partnerTax = calculateAnnualNetIncome(annualPartnerGross, 0, 0, tax, {
        hasChildUnder12,
        isAOWAge,
        isSingle: false,
        isJonggehandicapt: false,
        currentYear: year,
        box2Income: 0,
        hasSelfEmployment: false,
      });
      monthlyNetIncome = (primaryTax.netIncome + partnerTax.netIncome) / 12;
    } else {
      const taxResult = calculateAnnualNetIncome(annualGrossIncome, annualMortgageInterest, ewf, tax, {
        hasChildUnder12,
        isAOWAge,
        isSingle,
        isJonggehandicapt: tax.jonggehandicaptEnabled,
        currentYear: year,
        box2Income: income.box2Income ?? 0,
        hasSelfEmployment: income.sideIncomes.some((si) => si.isSelfEmployed),
      });
      monthlyNetIncome = taxResult.netIncome / 12;
    }

    // Box 3 is a real tax cash outflow and should reduce monthly disposable income,
    // including during retirement years.
    let totalInvestmentValueForTax = 0;
    for (const bal of investmentBalances.values()) totalInvestmentValueForTax += bal;
    const annualBox3Tax = calculateBox3Tax(
      cashBalance,
      totalInvestmentValueForTax,
      box3MortgageDebt,
      tax,
      tax.filingType === 'couple',
      box3PropertyValue,
    );
    const monthlyBox3Tax = annualBox3Tax / 12;
    monthlyNetIncome -= monthlyBox3Tax;

    // ---- Toeslagen (government benefits) ----
    const totalInvestmentValueForToeslagen = totalInvestmentValueForTax;
    const totalWealth = cashBalance + totalInvestmentValueForToeslagen;

    const toeslagenResult = calculateAnnualToeslagen(
      annualGrossIncome,
      totalWealth,
      allChildren.filter((c) => {
        const childAge = (currentDate.getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return childAge >= 0 && childAge < 18;
      }),
      currentDate,
      tax.filingType === 'couple',
      !hasPartner,
      scenario.toeslagen,
    );
    const monthlyToeslagen = toeslagenResult.total / 12;

    // ---- Investment growth ----
    // Only invest if not retired (or if retired, don't contribute)
    const adjustedAccounts = investments.accounts.map(acc => ({
      ...acc,
      monthlyContribution: isRetired ? 0 : acc.monthlyContribution,
    }));

    const portfolioResult = calculatePortfolioMonth(adjustedAccounts, investmentBalances, month);
    for (const [id, bal] of portfolioResult.newBalances) {
      investmentBalances.set(id, bal);
    }

    // ---- Retirement withdrawals ----
    let withdrawals = 0;
    let taxAdvantagedWithdrawals = 0; // pension/lijfrente withdrawals → taxed as Box 1
    const emergencyFund = investments.emergencyFund ?? 0;
    if (isRetired) {
      // Need to fund: expenses + mortgage - net income from pensions - toeslagen
      const totalNeeds = monthlyExpenses + totalMortgagePayment;
      const deficit = totalNeeds - monthlyNetIncome - monthlyToeslagen;
      if (deficit > 0) {
        withdrawals = deficit;
        let remaining = deficit;

        if (retirement.withdrawalStrategy === 'tax-efficient') {
          // Tax-efficient order: cash → savings → brokerage → pension/lijfrente
          // 1. Cash above emergency fund
          const cashAvailable = Math.max(0, cashBalance - emergencyFund);
          const fromCash = Math.min(remaining, cashAvailable);
          cashBalance -= fromCash;
          remaining -= fromCash;

          // 2-4. Accounts by type priority: savings → brokerage → pension/lijfrente
          const typePriority: Array<InvestmentAccount['type']> = ['savings', 'brokerage', 'pension', 'lijfrente'];
          for (const accType of typePriority) {
            if (remaining <= 0) break;
            for (const acc of investments.accounts) {
              if (remaining <= 0) break;
              if (acc.type !== accType) continue;
              const bal = investmentBalances.get(acc.id) ?? 0;
              const draw = Math.min(remaining, bal);
              if (draw > 0) {
                investmentBalances.set(acc.id, bal - draw);
                remaining -= draw;
                if (accType === 'pension' || accType === 'lijfrente') {
                  taxAdvantagedWithdrawals += draw;
                }
              }
            }
          }
          // Add remaining withdrawn funds to cash so net cash flow works
          cashBalance += deficit - remaining - fromCash;
        } else {
          // Proportional withdrawal (original behavior)
          let totalInvestments = 0;
          for (const bal of investmentBalances.values()) totalInvestments += bal;
          if (totalInvestments > 0) {
            for (const [id, bal] of investmentBalances) {
              const share = bal / totalInvestments;
              const draw = withdrawals * share;
              investmentBalances.set(id, Math.max(0, bal - draw));
              // Track tax-advantaged portion
              const acc = investments.accounts.find(a => a.id === id);
              if (acc && (acc.type === 'pension' || acc.type === 'lijfrente')) {
                taxAdvantagedWithdrawals += Math.min(draw, bal);
              }
            }
            cashBalance += withdrawals;
          }
        }
      }
    }

    // ---- Cash flow ----
    const totalMonthlyIncome = monthlyNetIncome + monthlyToeslagen;
    const grossCashFlow = totalMonthlyIncome - monthlyExpenses - totalMortgagePayment;

    // Ring-fence the emergency fund: cap investment contributions so cash ≥ emergencyFund
    const maxContributions = Math.max(0, cashBalance + grossCashFlow - emergencyFund);
    const actualContributions = Math.min(portfolioResult.totalContributions, maxContributions);
    // If contributions were capped, scale back investment balances proportionally
    if (actualContributions < portfolioResult.totalContributions && portfolioResult.totalContributions > 0) {
      const scale = actualContributions / portfolioResult.totalContributions;
      for (const acc of investments.accounts) {
        if (acc.monthlyContribution > 0 && !isRetired) {
          const currentBal = investmentBalances.get(acc.id) ?? 0;
          const fullContrib = acc.monthlyContribution;
          const reduction = fullContrib * (1 - scale);
          investmentBalances.set(acc.id, Math.max(0, currentBal - reduction));
        }
      }
    }

    const monthlyNetCashFlow = grossCashFlow - actualContributions;
    cashBalance += monthlyNetCashFlow;

    // ---- Net worth ----
    let totalInvestmentValue = 0;
    for (const bal of investmentBalances.values()) totalInvestmentValue += bal;
    const netWorth = cashBalance + totalInvestmentValue + totalPropertyValue - totalMortgageBalance;
    const liquidNetWorth = cashBalance + totalInvestmentValue;

    // ---- Savings rate ----
    const savingsRate = totalMonthlyIncome > 0
      ? (totalMonthlyIncome - monthlyExpenses - totalMortgagePayment) / totalMonthlyIncome
      : 0;

    // ---- FIRE check ----
    // Inflate the FIRE target: desired spending grows with inflation over time
    const inflationAdjustedFireNumber = fireNumber * Math.pow(1 + inflationRate, m / 12);
    if (!fireDate && (cashBalance + totalInvestmentValue) >= inflationAdjustedFireNumber) {
      fireDate = dateStr;
      fireAgeValue = currentAge;
    }

    // ---- Record snapshot ----
    months.push({
      date: dateStr,
      month: m,
      age: currentAge,
      grossIncome: monthlyGrossIncome,
      netIncome: monthlyNetIncome,
      totalExpenses: monthlyExpenses,
      mortgagePayment: totalMortgagePayment,
      mortgageInterest: totalMortgageInterest,
      mortgagePrincipalPayment: totalMortgagePrincipal,
      savings: monthlyNetCashFlow + portfolioResult.totalContributions,
      investmentValue: totalInvestmentValue,
      investmentGains: portfolioResult.totalGrowth,
      propertyValue: totalPropertyValue,
      mortgageBalance: totalMortgageBalance,
      netWorth,
      liquidNetWorth,
      savingsRate,
      cashBalance,
      toeslagenIncome: monthlyToeslagen,
      isRetired,
    });

    // ---- Accumulate annual data ----
    if (!annualData.has(year)) {
      annualData.set(year, {
        year,
        age: Math.floor(currentAge),
        grossIncome: 0,
        taxBox1: 0,
        taxBox3: 0,
        taxCredits: 0,
        netIncome: 0,
        totalExpenses: 0,
        totalMortgagePayments: 0,
        totalInvestmentContributions: 0,
        investmentReturns: 0,
        endNetWorth: 0,
        endLiquidNetWorth: 0,
        endInvestmentValue: 0,
        endPropertyValue: 0,
        endMortgageBalance: 0,
        endCashBalance: 0,
        totalToeslagen: 0,
        savingsRate: 0,
        effectiveTaxRate: 0,
      });
    }
    const annual = annualData.get(year)!;
    annual.grossIncome! += monthlyGrossIncome;
    annual.netIncome! += monthlyNetIncome;
    (annual as any).primaryGross = ((annual as any).primaryGross ?? 0) + primaryMonthlyGross;
    (annual as any).partnerGross = ((annual as any).partnerGross ?? 0) + partnerMonthlyGross;
    annual.totalExpenses! += monthlyExpenses;
    annual.totalMortgagePayments! += totalMortgagePayment;
    annual.totalInvestmentContributions! += portfolioResult.totalContributions;
    annual.investmentReturns! += portfolioResult.totalGrowth;
    annual.totalToeslagen! += monthlyToeslagen;
    annual.mortgageInterest = (annual.mortgageInterest ?? 0) + totalMortgageInterest;
    annual.eigenwoningforfait = ewf;
    annual.endNetWorth = netWorth;
    annual.endLiquidNetWorth = liquidNetWorth;
    annual.endInvestmentValue = totalInvestmentValue;
    annual.endPropertyValue = totalPropertyValue;
    annual.endMortgageBalance = totalMortgageBalance;
    annual.endCashBalance = cashBalance;
    (annual as any).box3PropertyValue = box3PropertyValue;
    (annual as any).box3MortgageDebt = box3MortgageDebt;
    (annual as any).taxAdvantagedWithdrawals = ((annual as any).taxAdvantagedWithdrawals ?? 0) + taxAdvantagedWithdrawals;
    // Track flags needed for annual tax recalculation (use the last month's values)
    (annual as any).hasChildUnder12 = hasChildUnder12;
    (annual as any).isAOWAge = isAOWAge;
    (annual as any).isSingle = isSingle;
  }

  // ---- Build annual summaries ----
  const annualSummaries: AnnualSummary[] = [];
  for (const [, data] of annualData) {
    const gross = data.grossIncome ?? 0;
    const net = data.netIncome ?? 0;
    const annualMortInt = data.mortgageInterest ?? 0;
    const annualEwf = data.eigenwoningforfait ?? 0;
    // Tax-advantaged withdrawals (pension/lijfrente) are taxed as Box 1 income
    const taxAdvWithdrawals = (data as any).taxAdvantagedWithdrawals ?? 0;
    const primaryGrossAnnual = ((data as any).primaryGross ?? gross) + taxAdvWithdrawals;
    const partnerGrossAnnual = (data as any).partnerGross ?? 0;

    const b3PropertyValue = (data as any).box3PropertyValue ?? 0;
    const b3MortgageDebt = (data as any).box3MortgageDebt ?? 0;
    const annualHasChildUnder12: boolean = (data as any).hasChildUnder12 ?? false;
    const annualIsAOWAge: boolean = (data as any).isAOWAge ?? false;
    const annualIsSingle: boolean = (data as any).isSingle ?? true;

    // Partner income splitting for annual recalculation
    let taxResult: {
      incomeTax: number;
      generalCredit: number;
      labourCredit: number;
      iackCredit: number;
      ouderenCredit: number;
      effectiveRate: number;
    };
    let primaryTaxBreakdown: AnnualSummary['primaryTax'];
    let partnerTaxBreakdown: AnnualSummary['partnerTax'];

    if (partnerGrossAnnual > 0 && tax.filingType === 'couple') {
      const primaryTax = calculateAnnualNetIncome(primaryGrossAnnual, annualMortInt, annualEwf, tax, {
        hasChildUnder12: annualHasChildUnder12,
        isAOWAge: annualIsAOWAge,
        isSingle: false,
        isJonggehandicapt: tax.jonggehandicaptEnabled,
        currentYear: data.year!,
        box2Income: income.box2Income ?? 0,
        hasSelfEmployment: income.sideIncomes.some((si) => si.isSelfEmployed),
      });
      const partnerTax = calculateAnnualNetIncome(partnerGrossAnnual, 0, 0, tax, {
        hasChildUnder12: annualHasChildUnder12,
        isAOWAge: annualIsAOWAge,
        isSingle: false,
        isJonggehandicapt: false,
        currentYear: data.year!,
        box2Income: 0,
        hasSelfEmployment: false,
      });
      taxResult = {
        incomeTax: primaryTax.incomeTax + partnerTax.incomeTax,
        generalCredit: primaryTax.generalCredit + partnerTax.generalCredit,
        labourCredit: primaryTax.labourCredit + partnerTax.labourCredit,
        iackCredit: primaryTax.iackCredit + partnerTax.iackCredit,
        ouderenCredit: primaryTax.ouderenCredit + partnerTax.ouderenCredit,
        effectiveRate: (gross + taxAdvWithdrawals) > 0
          ? ((primaryGrossAnnual - primaryTax.netIncome) + (partnerGrossAnnual - partnerTax.netIncome)) / (gross + taxAdvWithdrawals)
          : 0,
      };
      primaryTaxBreakdown = {
        grossIncome: primaryGrossAnnual,
        incomeTax: primaryTax.incomeTax,
        generalCredit: primaryTax.generalCredit,
        labourCredit: primaryTax.labourCredit,
        iackCredit: primaryTax.iackCredit,
        ouderenCredit: primaryTax.ouderenCredit,
        jonggehandicaptCredit: primaryTax.jonggehandicaptCredit,
        zvw: primaryTax.zvw,
        netIncome: primaryTax.netIncome,
        effectiveRate: primaryTax.effectiveRate,
        lijfrenteDeduction: primaryTax.lijfrenteDeduction,
        hillenRelief: primaryTax.hillenRelief,
        giftenDeduction: primaryTax.giftenDeduction,
        alimentatieDeduction: primaryTax.alimentatieDeduction,
        selfEmploymentDeduction: primaryTax.selfEmploymentDeduction,
        box2Tax: primaryTax.box2Tax,
      };
      partnerTaxBreakdown = {
        grossIncome: partnerGrossAnnual,
        incomeTax: partnerTax.incomeTax,
        generalCredit: partnerTax.generalCredit,
        labourCredit: partnerTax.labourCredit,
        iackCredit: partnerTax.iackCredit,
        ouderenCredit: partnerTax.ouderenCredit,
        jonggehandicaptCredit: partnerTax.jonggehandicaptCredit,
        zvw: partnerTax.zvw,
        netIncome: partnerTax.netIncome,
        effectiveRate: partnerTax.effectiveRate,
        lijfrenteDeduction: partnerTax.lijfrenteDeduction,
        hillenRelief: partnerTax.hillenRelief,
        giftenDeduction: partnerTax.giftenDeduction,
        alimentatieDeduction: partnerTax.alimentatieDeduction,
        selfEmploymentDeduction: partnerTax.selfEmploymentDeduction,
        box2Tax: partnerTax.box2Tax,
      };
    } else {
      const taxableGross = gross + taxAdvWithdrawals;
      const singleResult = calculateAnnualNetIncome(taxableGross, annualMortInt, annualEwf, tax, {
        hasChildUnder12: annualHasChildUnder12,
        isAOWAge: annualIsAOWAge,
        isSingle: annualIsSingle,
        isJonggehandicapt: tax.jonggehandicaptEnabled,
        currentYear: data.year!,
        box2Income: income.box2Income ?? 0,
        hasSelfEmployment: income.sideIncomes.some((si) => si.isSelfEmployed),
      });
      taxResult = singleResult;
      // Store as primaryTax even for singles so the sidebar can always use it
      primaryTaxBreakdown = {
        grossIncome: taxableGross,
        incomeTax: singleResult.incomeTax,
        generalCredit: singleResult.generalCredit,
        labourCredit: singleResult.labourCredit,
        iackCredit: singleResult.iackCredit,
        ouderenCredit: singleResult.ouderenCredit,
        jonggehandicaptCredit: singleResult.jonggehandicaptCredit,
        zvw: singleResult.zvw,
        netIncome: singleResult.netIncome,
        effectiveRate: singleResult.effectiveRate,
        lijfrenteDeduction: singleResult.lijfrenteDeduction,
        hillenRelief: singleResult.hillenRelief,
        giftenDeduction: singleResult.giftenDeduction,
        alimentatieDeduction: singleResult.alimentatieDeduction,
        selfEmploymentDeduction: singleResult.selfEmploymentDeduction,
        box2Tax: singleResult.box2Tax,
      };
      partnerTaxBreakdown = undefined;
    }

    // Box 3 for year-end using that year's end values
    // Only non-owner-occupied property values and debts belong in box 3
    // (owner-occupied home + its mortgage are handled in box 1)
    const box3 = calculateBox3Tax(
      data.endCashBalance ?? 0,
      data.endInvestmentValue ?? 0,
      b3MortgageDebt,
      tax,
      tax.filingType === 'couple',
      b3PropertyValue,
    );

    annualSummaries.push({
      year: data.year!,
      age: data.age!,
      grossIncome: gross,
      taxBox1: taxResult.incomeTax,
      taxBox3: box3,
      taxCredits: taxResult.generalCredit + taxResult.labourCredit + taxResult.iackCredit + taxResult.ouderenCredit,
      netIncome: net,
      totalExpenses: data.totalExpenses!,
      totalMortgagePayments: data.totalMortgagePayments!,
      totalInvestmentContributions: data.totalInvestmentContributions!,
      investmentReturns: data.investmentReturns!,
      endNetWorth: data.endNetWorth!,
      endLiquidNetWorth: data.endLiquidNetWorth!,
      endInvestmentValue: data.endInvestmentValue!,
      endPropertyValue: data.endPropertyValue!,
      endMortgageBalance: data.endMortgageBalance!,
      endCashBalance: data.endCashBalance!,
      totalToeslagen: data.totalToeslagen ?? 0,
      savingsRate: gross > 0 ? (net - data.totalExpenses! - data.totalMortgagePayments!) / net : 0,
      effectiveTaxRate: taxResult.effectiveRate,
      primaryTax: primaryTaxBreakdown,
      partnerTax: partnerTaxBreakdown,
      mortgageInterestDeduction: annualMortInt,
      eigenwoningforfait: annualEwf,
      box3PropertyValue: b3PropertyValue,
      box3MortgageDebt: b3MortgageDebt,
    });
  }

  // ---- Calculate Coast FIRE ----
  const avgReturn = investments.accounts.length > 0
    ? investments.accounts.reduce((s, a) => s + a.expectedReturn, 0) / investments.accounts.length
    : 0.07;
  const yearsToRetirement = Math.max(0, retirementAge - startAge);
  // Use the inflation-adjusted FIRE target at retirement for Coast FIRE
  const fireNumberAtRetirement = fireNumber * Math.pow(1 + inflationRate, yearsToRetirement);
  const coastFireAmount = calculateCoastFire(fireNumberAtRetirement, yearsToRetirement, avgReturn);
  let totalCurrentInvestments = 0;
  for (const acc of investments.accounts) totalCurrentInvestments += acc.balance;
  const coastFireAge = (totalCurrentInvestments + investments.currentSavings) >= coastFireAmount
    ? startAge
    : null;

  // ---- Current net worth ----
  const currentNetWorth = months.length > 0 ? months[0].netWorth : 0;
  const currentLiquidNetWorth = months.length > 0 ? months[0].liquidNetWorth : 0;
  const retirementMonthIndex = months.findIndex(m => m.isRetired);
  const projectedNetWorthAtRetirement = retirementMonthIndex >= 0
    ? months[retirementMonthIndex].netWorth
    : months[months.length - 1]?.netWorth ?? 0;

  const currentSavingsRate = months.length > 0 ? months[0].savingsRate : 0;

  // Retirement readiness
  let retirementReadiness: 'ahead' | 'on-track' | 'behind' = 'on-track';
  if (fireAgeValue !== null) {
    if (fireAgeValue < retirementAge - 2) retirementReadiness = 'ahead';
    else if (fireAgeValue > retirementAge + 2) retirementReadiness = 'behind';
  } else {
    retirementReadiness = 'behind';
  }

  return {
    months,
    annualSummaries,
    fireDate,
    fireAge: fireAgeValue,
    fireNumber,
    coastFireAge: coastFireAge ? Math.floor(coastFireAge) : null,
    coastFireNumber: coastFireAmount,
    yearsToFire: fireAgeValue ? fireAgeValue - startAge : null,
    currentNetWorth,
    currentLiquidNetWorth,
    projectedNetWorthAtRetirement,
    savingsRate: currentSavingsRate,
    retirementReadiness,
  };
}

// ---- Life Event Processor ----

interface EventHandlers {
  onSalaryChange: (amount: number, isPartner: boolean) => void;
  onPartnerChange: (active: boolean) => void;
  onLumpSum: (amount: number) => void;
  onCareerBreak: (durationMonths: number) => void;
  onChildBorn: (monthlyExpense: number, event: LifeEvent) => void;
}

function processLifeEvents(events: LifeEvent[], currentDate: Date, handlers: EventHandlers) {
  for (const event of events) {
    const eventDate = new Date(event.date);
    if (
      eventDate.getFullYear() === currentDate.getFullYear() &&
      eventDate.getMonth() === currentDate.getMonth()
    ) {
      switch (event.type) {
        case 'salary_change':
          handlers.onSalaryChange(event.amount, false);
          break;
        case 'inheritance':
        case 'lump_sum':
          handlers.onLumpSum(event.amount);
          break;
        case 'partner_change':
          handlers.onPartnerChange(event.amount > 0);
          break;
        case 'custom':
          handlers.onLumpSum(event.amount);
          break;
        case 'buy_property':
          // Property purchases are handled via HousingConfig
          // The lump sum impact (down payment / costs) is tracked via amount
          handlers.onLumpSum(-Math.abs(event.amount));
          break;
        case 'sell_property':
          // Sale proceeds as lump sum income
          handlers.onLumpSum(event.amount);
          break;
        case 'child_born':
          // Add child with the event amount as monthly expense (default ~€500)
          handlers.onChildBorn(event.amount > 0 ? event.amount : 500, event);
          break;
        case 'career_break':
          handlers.onCareerBreak(event.durationMonths ?? 12);
          break;
      }
    }
  }
}
