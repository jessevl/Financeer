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
  Property,
} from '@/types';
import { calculateAnnualNetIncome, calculateBox3Tax, calculateEigenwoningforfait } from './tax';
import { calculateMonthlyMortgagePayment, getMortgageSnapshotAtDate } from './mortgage';
import { calculateMonthlyInvestmentGrowth, calculatePortfolioMonth, calculateFireNumber, calculateCoastFire } from './investment';
import { calculateAnnualToeslagen } from './toeslagen';
import { getChildcareArrangements, isChildcareArrangementEligible } from '@/lib/childcare';
import { getLifeEventPropertyFromPurchase, normalizeLifeEvents } from '@/lib/lifeEvents';

export interface RetirementIncomePhase {
  label: string;
  annualIncome: number;
  startAge: number;
  endAge?: number;
}

interface CareerBreakState {
  endMonth: number;
  baseSalary: number;
  replacementRate: number;
  monthlyExpenseChange: number;
}

function isTaxAdvantagedAccount(account: InvestmentAccount): boolean {
  return account.type === 'lijfrente';
}

function isTaxableInvestmentAccount(account: InvestmentAccount): boolean {
  return account.type === 'brokerage' || account.type === 'real-estate';
}

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

export function calculateAnnualAowIncome(
  aowMonthlyAmount: number,
  isCoupleHousehold: boolean,
  partnerAowMonthlyAmount?: number,
): number {
  const partnerMonthlyAmount = partnerAowMonthlyAmount ?? aowMonthlyAmount;
  return (aowMonthlyAmount + (isCoupleHousehold ? partnerMonthlyAmount : 0)) * 12;
}

function calculateAgeAtDate(dateOfBirth: string, atDate: Date): number {
  return (atDate.getTime() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function getPartnerDateOfBirth(settings: GlobalSettings): string {
  return settings.partnerDateOfBirth || settings.dateOfBirth;
}

function calculateAssumedDeathDate(dateOfBirth: string, lifeExpectancyAge: number): Date {
  const deathDate = new Date(dateOfBirth);
  deathDate.setFullYear(deathDate.getFullYear() + Math.max(0, lifeExpectancyAge));
  return deathDate;
}

function getLifetimePayoutEndAge(
  settings: GlobalSettings,
  isCoupleHousehold: boolean,
  partnerContinuation = false,
): number {
  const primaryDeathDate = calculateAssumedDeathDate(settings.dateOfBirth, settings.lifeExpectancyAge);
  const partnerDeathDate = calculateAssumedDeathDate(getPartnerDateOfBirth(settings), settings.partnerLifeExpectancyAge);
  const payoutEndDate = partnerContinuation && isCoupleHousehold && partnerDeathDate.getTime() > primaryDeathDate.getTime()
    ? partnerDeathDate
    : primaryDeathDate;

  return calculateAgeAtDate(settings.dateOfBirth, payoutEndDate);
}

function calculateLevelMonthlyPayout(balance: number, annualNetReturn: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;

  const monthlyRate = Math.max(0, annualNetReturn) / 12;
  if (monthlyRate === 0) return balance / months;

  return balance * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
}

function projectBalanceWithoutContributions(
  account: InvestmentAccount,
  currentBalance: number,
  monthsUntilStart: number,
  startMonth: number,
): number {
  if (monthsUntilStart <= 0) return currentBalance;

  const projectionAccount = { ...account, monthlyContribution: 0 };
  let projectedBalance = currentBalance;

  for (let offset = 0; offset < monthsUntilStart; offset++) {
    projectedBalance = calculateMonthlyInvestmentGrowth(
      projectionAccount,
      projectedBalance,
      (startMonth + offset) % 12,
    ).newBalance;
  }

  return projectedBalance;
}

function getRemainingPayoutMonths(
  account: InvestmentAccount,
  currentDate: Date,
  currentAge: number,
  settings: GlobalSettings,
  isCoupleHousehold: boolean,
): number {
  const payoutPhase = account.payoutPhase ?? 'accumulation';
  if (payoutPhase === 'accumulation') return 0;

  const startYear = account.payoutStartYear ?? currentDate.getFullYear();
  if (currentDate.getFullYear() < startYear) return 0;

  if (payoutPhase === 'fixed-term') {
    const durationYears = Math.max(1, account.payoutDurationYears ?? 20);
    const endYear = startYear + durationYears;
    return Math.max(0, (endYear - currentDate.getFullYear()) * 12 - currentDate.getMonth());
  }

  const endAge = getLifetimePayoutEndAge(settings, isCoupleHousehold, account.partnerContinuation);
  return Math.max(0, Math.ceil((endAge - currentAge) * 12));
}

export function buildTaxAdvantagedIncomePhases(params: {
  accounts: InvestmentAccount[];
  balances?: Map<string, number>;
  currentDate: Date;
  currentAge: number;
  settings: GlobalSettings;
  isCoupleHousehold: boolean;
}): RetirementIncomePhase[] {
  const { accounts, balances, currentDate, currentAge, settings, isCoupleHousehold } = params;

  return accounts.flatMap((account) => {
    if (!isTaxAdvantagedAccount(account) || (account.payoutPhase ?? 'accumulation') === 'accumulation') {
      return [];
    }

    const currentBalance = balances?.get(account.id) ?? account.balance;
    if (currentBalance <= 0) return [];

    const startYear = account.payoutStartYear ?? currentDate.getFullYear();
    const monthsUntilStart = Math.max(0, (startYear - currentDate.getFullYear()) * 12 - currentDate.getMonth());
    const phaseStartAge = monthsUntilStart > 0 ? currentAge + monthsUntilStart / 12 : currentAge;
    const projectedBalance = projectBalanceWithoutContributions(account, currentBalance, monthsUntilStart, currentDate.getMonth());

    let phaseEndAge: number | undefined;
    let payoutMonths = 0;

    if ((account.payoutPhase ?? 'accumulation') === 'fixed-term') {
      const durationYears = Math.max(1, account.payoutDurationYears ?? 20);
      if (monthsUntilStart > 0) {
        payoutMonths = durationYears * 12;
        phaseEndAge = phaseStartAge + durationYears;
      } else {
        payoutMonths = getRemainingPayoutMonths(account, currentDate, currentAge, settings, isCoupleHousehold);
        if (payoutMonths <= 0) return [];
        phaseEndAge = currentAge + payoutMonths / 12;
      }
    } else {
      phaseEndAge = getLifetimePayoutEndAge(settings, isCoupleHousehold, account.partnerContinuation);
      payoutMonths = Math.max(0, Math.ceil((phaseEndAge - phaseStartAge) * 12));
    }

    if (payoutMonths <= 0) return [];

    const annualIncome = calculateLevelMonthlyPayout(
      projectedBalance,
      account.expectedReturn - account.expenseRatio,
      payoutMonths,
    ) * 12;

    if (annualIncome <= 0) return [];

    return [{
      label: account.name,
      annualIncome,
      startAge: phaseStartAge,
      endAge: phaseEndAge,
    }];
  });
}

function getCurrentTaxAdvantagedPayouts(params: {
  accounts: InvestmentAccount[];
  balances: Map<string, number>;
  currentDate: Date;
  currentAge: number;
  settings: GlobalSettings;
  isCoupleHousehold: boolean;
}): Array<{ accountId: string; amount: number }> {
  const { accounts, balances, currentDate, currentAge, settings, isCoupleHousehold } = params;

  return accounts.flatMap((account) => {
    if (!isTaxAdvantagedAccount(account) || (account.payoutPhase ?? 'accumulation') === 'accumulation') {
      return [];
    }

    const balance = balances.get(account.id) ?? 0;
    if (balance <= 0) return [];

    const remainingMonths = getRemainingPayoutMonths(account, currentDate, currentAge, settings, isCoupleHousehold);
    if (remainingMonths <= 0) return [];

    const amount = Math.min(
      balance,
      calculateLevelMonthlyPayout(balance, account.expectedReturn - account.expenseRatio, remainingMonths),
    );

    return amount > 0 ? [{ accountId: account.id, amount }] : [];
  });
}

export function calculateRetirementCapitalTarget(params: {
  currentAge: number;
  desiredAnnualSpending: number;
  safeWithdrawalRate: number;
  pensionStartAge: number;
  annualPensionIncome: number;
  aowStartAge: number;
  annualAowIncome: number;
  additionalIncomePhases?: RetirementIncomePhase[];
}): number {
  const {
    currentAge,
    desiredAnnualSpending,
    safeWithdrawalRate,
    pensionStartAge,
    annualPensionIncome,
    aowStartAge,
    annualAowIncome,
    additionalIncomePhases = [],
  } = params;

  const annualGuaranteedIncomeAtAge = (age: number) => {
    let income = 0;
    if (age >= pensionStartAge) income += annualPensionIncome;
    if (age >= aowStartAge) income += annualAowIncome;
    for (const phase of additionalIncomePhases) {
      if (age >= phase.startAge && (phase.endAge === undefined || age < phase.endAge)) {
        income += phase.annualIncome;
      }
    }
    return income;
  };

  const phaseStarts = [
    pensionStartAge,
    aowStartAge,
    ...additionalIncomePhases.flatMap((phase) => phase.endAge === undefined ? [phase.startAge] : [phase.startAge, phase.endAge]),
  ]
    .filter((age, index, ages) => age > currentAge && ages.indexOf(age) === index)
    .sort((left, right) => left - right);

  let capital = 0;
  let ageCursor = currentAge;

  for (const nextPhaseAge of phaseStarts) {
    const years = nextPhaseAge - ageCursor;
    if (years <= 0) continue;

    const annualGap = Math.max(0, desiredAnnualSpending - annualGuaranteedIncomeAtAge(ageCursor));
    capital += annualGap * years;
    ageCursor = nextPhaseAge;
  }

  const longTermGap = Math.max(0, desiredAnnualSpending - annualGuaranteedIncomeAtAge(ageCursor));
  capital += calculateFireNumber(longTermGap, safeWithdrawalRate);

  return capital;
}

/**
 * Run the full financial simulation for a scenario
 */
export function runSimulation(scenario: Scenario, settings: GlobalSettings): SimulationResult {
  // Start simulation from January 1st of the current year so the first year is always complete
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
  const startAge = calculateAgeAtDate(settings.dateOfBirth, startDate);
  const endAge = settings.simulationEndAge;
  const totalMonths = Math.ceil((endAge - startAge) * 12);

  const { income, tax, expenses, housing, investments, retirement } = scenario;
  const inflationRate = expenses.customInflationRate ?? settings.inflationRate;
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12) - 1;

  // ---- Initial state ----
  const accounts = (() => {
    const clonedAccounts = investments.accounts.map((account) => ({ ...account }));
    const legacyCash = investments.currentSavings ?? 0;
    const existingSavings = clonedAccounts.find((account) => account.type === 'savings');

    if (existingSavings) {
      if (legacyCash > 0) existingSavings.balance += legacyCash;
      return clonedAccounts;
    }

    return [{
      id: '__simulation-savings__',
      name: 'Savings Account',
      type: 'savings' as const,
      balance: legacyCash,
      monthlyContribution: 0,
      expectedReturn: 0.02,
      volatility: 0,
      expenseRatio: 0,
      compoundingFrequency: 'monthly' as const,
      reinvestDividends: false,
    }, ...clonedAccounts];
  })();

  const investmentBalances = new Map<string, number>();
  for (const acc of accounts) {
    investmentBalances.set(acc.id, acc.balance);
  }

  const savingsAccounts = accounts.filter((account) => account.type === 'savings');
  const eligibleSweepAccounts = accounts.filter((account) => account.type !== 'lijfrente');
  const autoSweepAccountId = eligibleSweepAccounts.some((account) => account.id === investments.autoSweepAccountId)
    ? investments.autoSweepAccountId
    : eligibleSweepAccounts[0]?.id;

  const getBalanceForTypes = (types: InvestmentAccount['type'][]): number => {
    let total = 0;
    for (const account of accounts) {
      if (types.includes(account.type)) {
        total += investmentBalances.get(account.id) ?? 0;
      }
    }
    return total;
  };

  const getSavingsBalance = () => getBalanceForTypes(['savings']);
  const getInvestedAssetBalance = () => getBalanceForTypes(['brokerage', 'real-estate', 'lijfrente']);
  const getTaxableInvestmentBalance = () => getBalanceForTypes(['brokerage', 'real-estate']);

  const cloneProperty = (property: Property): Property => ({
    ...property,
    mortgages: property.mortgages.map((mortgage) => ({
      ...mortgage,
      extraRepayments: mortgage.extraRepayments.map((repayment) => ({ ...repayment })),
    })),
  });

  const isSameMonth = (left: Date, right: Date) => (
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
  );

  const getPropertyStartDate = (property: Property) => {
    const rawDate = property.startDate || property.mortgages[0]?.startDate;
    const parsedDate = rawDate ? new Date(rawDate) : startDate;
    return Number.isNaN(parsedDate.getTime()) ? startDate : parsedDate;
  };
  const getPropertyEndDate = (property: Property) => {
    if (!property.endDate) return null;
    const parsedDate = new Date(property.endDate);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };
  const hasPropertyStarted = (property: Property, atDate: Date) => {
    const start = getPropertyStartDate(property);
    return atDate.getFullYear() > start.getFullYear()
      || (atDate.getFullYear() === start.getFullYear() && atDate.getMonth() >= start.getMonth());
  };

  const activeProperties = housing.properties.map(cloneProperty);
  const propertyAcquiredDates = new Map<string, Date>();
  const processedPropertyStarts = new Set<string>();
  for (const property of activeProperties) {
    const propertyStartDate = getPropertyStartDate(property);
    propertyAcquiredDates.set(property.id, propertyStartDate > startDate ? propertyStartDate : startDate);
    if (propertyStartDate <= startDate) processedPropertyStarts.add(property.id);
  }

  const applySavingsCashFlow = (amount: number) => {
    if (savingsAccounts.length === 0 || amount === 0) return;

    const primarySavings = savingsAccounts[0];

    if (amount > 0) {
      investmentBalances.set(primarySavings.id, (investmentBalances.get(primarySavings.id) ?? 0) + amount);
      return;
    }

    let remaining = -amount;
    for (const account of savingsAccounts) {
      if (remaining <= 0) break;
      const balance = investmentBalances.get(account.id) ?? 0;
      const draw = Math.min(remaining, Math.max(0, balance));
      if (draw > 0) {
        investmentBalances.set(account.id, balance - draw);
        remaining -= draw;
      }
    }
    if (remaining > 0) {
      investmentBalances.set(primarySavings.id, (investmentBalances.get(primarySavings.id) ?? 0) - remaining);
    }
  };

  const applyAutoSweepCashFlow = (amount: number, emergencyFundTarget: number) => {
    if (amount <= 0) {
      applySavingsCashFlow(amount);
      return;
    }

    const savingsShortfall = Math.max(0, emergencyFundTarget - getSavingsBalance());
    const toSavings = Math.min(amount, savingsShortfall);
    if (toSavings > 0) {
      applySavingsCashFlow(toSavings);
    }

    const remaining = amount - toSavings;
    if (remaining <= 0) return;

    if (!autoSweepAccountId) {
      applySavingsCashFlow(remaining);
      return;
    }

    investmentBalances.set(autoSweepAccountId, (investmentBalances.get(autoSweepAccountId) ?? 0) + remaining);
  };

  const withdrawFromSavings = (amount: number, protectedAmount: number) => {
    let remaining = Math.min(amount, Math.max(0, getSavingsBalance() - protectedAmount));
    let withdrawn = 0;

    for (const account of savingsAccounts) {
      if (remaining <= 0) break;
      const balance = investmentBalances.get(account.id) ?? 0;
      const draw = Math.min(remaining, Math.max(0, balance));
      if (draw > 0) {
        investmentBalances.set(account.id, balance - draw);
        remaining -= draw;
        withdrawn += draw;
      }
    }

    return withdrawn;
  };

  // Mortgage state per mortgage (keyed by mortgage id)
  const mortgageBalances = new Map<string, number>();
  const mortgageStartDates = new Map<string, Date>();
  for (const prop of activeProperties) {
    for (const mtg of prop.mortgages) {
      mortgageBalances.set(mtg.id, getMortgageSnapshotAtDate(mtg, startDate).balance);
      mortgageStartDates.set(mtg.id, new Date(mtg.startDate));
    }
  }

  // Income state (for merit increases and career events)
  let currentSalary = income.grossSalary;
  let currentPartnerSalary = income.partnerGrossSalary;
  let isCoupleHousehold = tax.filingType === 'couple';
  const retirementAge = retirement.targetAge;
  const pensionStartAge = retirement.pensionStartAge ?? retirement.targetAge;
  const aowAge = retirement.aowStartAge;
  const partnerAowMonthlyAmount = retirement.partnerAowMonthlyAmount ?? retirement.aowMonthlyAmount;

  // Compute pension monthly amount — middelloon estimation or flat
  const pensionMonthly = (retirement.pensionType === 'middelloon')
    ? calculateMiddelloonPension(retirement, income.grossSalary)
    : retirement.pensionMonthlyAmount;
  const partnerPensionMonthly = (retirement.pensionType === 'middelloon')
    ? calculateMiddelloonPension(retirement, income.partnerGrossSalary)
    : (retirement.partnerPensionMonthlyAmount ?? 0);
  const getAnnualAowIncome = (isCouple: boolean) => calculateAnnualAowIncome(
    retirement.aowMonthlyAmount,
    isCouple,
    partnerAowMonthlyAmount,
  );
  const getAnnualEmployerPensionIncome = (isCouple: boolean) => (pensionMonthly + (isCouple ? partnerPensionMonthly : 0)) * 12;
  const getTaxAdvantagedIncomePhases = (currentDate: Date, currentAge: number) => buildTaxAdvantagedIncomePhases({
    accounts,
    balances: investmentBalances,
    currentDate,
    currentAge,
    settings,
    isCoupleHousehold,
  });
  const fireNumber = calculateRetirementCapitalTarget({
    currentAge: startAge,
    desiredAnnualSpending: retirement.desiredAnnualSpending,
    safeWithdrawalRate: retirement.safeWithdrawalRate,
    pensionStartAge,
    annualPensionIncome: getAnnualEmployerPensionIncome(isCoupleHousehold),
    aowStartAge: aowAge,
    annualAowIncome: getAnnualAowIncome(isCoupleHousehold),
    additionalIncomePhases: getTaxAdvantagedIncomePhases(startDate, startAge),
  });

  const months: MonthlySnapshot[] = [];
  const annualData: Map<number, Partial<AnnualSummary> & { mortgageInterest?: number; eigenwoningforfait?: number }> = new Map();

  let fireDate: string | null = null;
  let fireAgeValue: number | null = null;
  let isRetired = false;
  let inflationFactor = 1;

  // Career break state — track when salary should auto-restore
  const careerBreakState: { primary: CareerBreakState | null; partner: CareerBreakState | null } = {
    primary: null,
    partner: null,
  };
  let householdExpenseAdjustment = 0;

  // Dynamic children added via life events
  const dynamicChildren: ChildConfig[] = [];

  // Sorted life events
  const sortedEvents = normalizeLifeEvents(scenario.lifeEvents).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const getElapsedMonthsSince = (start: Date, end: Date) => (
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  );

  const getPropertyValueAtDate = (property: Property, atDate: Date) => {
    const acquiredDate = propertyAcquiredDates.get(property.id) ?? startDate;
    const elapsedMonths = getElapsedMonthsSince(acquiredDate, atDate);
    if (elapsedMonths < 0) return 0;
    return property.value * Math.pow(1 + property.appreciationRate, elapsedMonths / 12);
  };

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
      onSalaryChange: (event) => {
        const nextSalary = event.salaryChangeMode === 'delta'
          ? (event.isPartner ? currentPartnerSalary : currentSalary) + (event.annualSalaryDelta ?? 0)
          : (event.annualSalary ?? 0);
        if (event.isPartner) currentPartnerSalary = nextSalary;
        else currentSalary = nextSalary;
      },
      onPartnerChange: (event) => {
        isCoupleHousehold = event.partnerActive ?? false;
        householdExpenseAdjustment += event.monthlyExpenseChange ?? 0;
        if (isCoupleHousehold) {
          if (currentPartnerSalary <= 0) currentPartnerSalary = income.partnerGrossSalary;
        } else {
          currentPartnerSalary = 0;
          careerBreakState.partner = null;
        }
      },
      onLumpSum: (amount) => { applySavingsCashFlow(amount); },
      onCareerBreak: (event) => {
        const durationMonths = event.durationMonths ?? 12;
        const replacementRate = event.incomeReplacementRate ?? 0;
        const monthlyExpenseChange = event.monthlyExpenseChange ?? 0;
        if (event.isPartner) {
          careerBreakState.partner = {
            endMonth: m + durationMonths,
            baseSalary: currentPartnerSalary,
            replacementRate,
            monthlyExpenseChange,
          };
          currentPartnerSalary = currentPartnerSalary * replacementRate;
        } else {
          careerBreakState.primary = {
            endMonth: m + durationMonths,
            baseSalary: currentSalary,
            replacementRate,
            monthlyExpenseChange,
          };
          currentSalary = currentSalary * replacementRate;
        }
      },
      onChildBorn: (event) => {
        dynamicChildren.push({
          id: `dynamic-child-${event.id}`,
          name: event.childName || event.label || 'Child',
          birthDate: currentDate.toISOString(),
          monthlyExpense: event.childMonthlyExpense ?? 500,
          childcareArrangements: event.childCareArrangements ?? [],
          kinderopvangType: 'none',
          kinderopvangHoursPerMonth: 0,
          kinderopvangHourlyRate: 0,
        });
      },
      onBuyProperty: (event) => {
        const property = getLifeEventPropertyFromPurchase(event);
        if (!property || activeProperties.some((activeProperty) => activeProperty.id === property.id)) return;

        const eventMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
        const propertyWithDates: Property = {
          ...property,
          startDate: eventMonth,
          endDate: undefined,
          purchaseCosts: event.propertyPurchaseCosts ?? 0,
          sellingCosts: 0,
          salePrice: undefined,
          mortgages: property.mortgages.map((mortgage) => ({
            ...mortgage,
            startDate: mortgage.startDate || eventMonth,
            deductibilityStartDate: mortgage.deductibilityStartDate || mortgage.startDate || eventMonth,
          })),
        };

        const totalMortgagePrincipal = propertyWithDates.mortgages.reduce((sum, mortgage) => sum + mortgage.principal, 0);
        const upfrontCash = Math.max(0, propertyWithDates.value - totalMortgagePrincipal) + (event.propertyPurchaseCosts ?? 0);
        if (upfrontCash > 0) applySavingsCashFlow(-upfrontCash);

        activeProperties.push(propertyWithDates);
        propertyAcquiredDates.set(propertyWithDates.id, new Date(currentDate));
        processedPropertyStarts.add(propertyWithDates.id);
        for (const mortgage of propertyWithDates.mortgages) {
          mortgageBalances.set(mortgage.id, mortgage.principal);
          mortgageStartDates.set(mortgage.id, new Date(mortgage.startDate));
        }
      },
      onSellProperty: (event) => {
        const propertyIndex = activeProperties.findIndex((property) => property.id === event.propertyId);
        if (propertyIndex === -1) return;
        const property = activeProperties[propertyIndex];
        const proceeds = (event.salePrice && event.salePrice > 0 ? event.salePrice : getPropertyValueAtDate(property, currentDate))
          - property.mortgages.reduce((sum, mortgage) => sum + (mortgageBalances.get(mortgage.id) ?? 0), 0)
          - (event.sellingCosts ?? 0);
        applySavingsCashFlow(proceeds);
        activeProperties.splice(propertyIndex, 1);
        propertyAcquiredDates.delete(property.id);
        processedPropertyStarts.delete(property.id);
      },
    });

    for (const property of [...activeProperties]) {
      const propertyStartDate = getPropertyStartDate(property);
      if (!processedPropertyStarts.has(property.id) && isSameMonth(propertyStartDate, currentDate)) {
        const totalMortgagePrincipal = property.mortgages.reduce((sum, mortgage) => sum + mortgage.principal, 0);
        const upfrontCash = Math.max(0, property.value - totalMortgagePrincipal) + (property.purchaseCosts ?? 0);
        if (upfrontCash > 0) applySavingsCashFlow(-upfrontCash);
        processedPropertyStarts.add(property.id);
      }

      const propertyEndDate = getPropertyEndDate(property);
      if (propertyEndDate && isSameMonth(propertyEndDate, currentDate)) {
        const proceeds = (property.salePrice && property.salePrice > 0 ? property.salePrice : getPropertyValueAtDate(property, currentDate))
          - property.mortgages.reduce((sum, mortgage) => sum + (mortgageBalances.get(mortgage.id) ?? 0), 0)
          - (property.sellingCosts ?? 0);
        applySavingsCashFlow(proceeds);
        const propertyIndex = activeProperties.findIndex((candidate) => candidate.id === property.id);
        if (propertyIndex !== -1) activeProperties.splice(propertyIndex, 1);
        propertyAcquiredDates.delete(property.id);
        processedPropertyStarts.delete(property.id);
      }
    }

    const currentProperties = activeProperties.filter((property) => hasPropertyStarted(property, currentDate));

    // ---- Auto-restore salary after career break duration ----
    if (careerBreakState.primary && m >= careerBreakState.primary.endMonth) {
      currentSalary = careerBreakState.primary.baseSalary;
      careerBreakState.primary = null;
    }
    if (careerBreakState.partner && m >= careerBreakState.partner.endMonth) {
      currentPartnerSalary = careerBreakState.partner.baseSalary;
      careerBreakState.partner = null;
    }

    // ---- Process career events from IncomeConfig ----
    if (!isRetired) {
      for (const ce of income.careerEvents) {
        const ceDate = new Date(ce.date);
        if (ceDate.getFullYear() === currentDate.getFullYear() && ceDate.getMonth() === currentDate.getMonth()) {
          if (ce.type === 'career_break') {
            const durationMonths = ce.durationMonths ?? 12;
            const replacementRate = ce.incomeReplacementRate ?? 0;
            const monthlyExpenseChange = ce.monthlyExpenseChange ?? 0;
            if (ce.isPartner) {
              careerBreakState.partner = {
                endMonth: m + durationMonths,
                baseSalary: currentPartnerSalary,
                replacementRate,
                monthlyExpenseChange,
              };
              currentPartnerSalary = currentPartnerSalary * replacementRate;
            } else {
              careerBreakState.primary = {
                endMonth: m + durationMonths,
                baseSalary: currentSalary,
                replacementRate,
                monthlyExpenseChange,
              };
              currentSalary = currentSalary * replacementRate;
            }
            continue;
          }

          const nextSalary = ce.salaryChangeMode === 'delta'
            ? (ce.isPartner ? currentPartnerSalary : currentSalary) + (ce.annualSalaryDelta ?? 0)
            : (ce.newGrossSalary ?? (ce.isPartner ? currentPartnerSalary : currentSalary));
          if (ce.isPartner) currentPartnerSalary = nextSalary;
          else currentSalary = nextSalary;
        }
      }
    }

    // ---- Apply annual merit increase (January) ----
    if (month === 0 && m > 0 && !isRetired) {
      if (careerBreakState.primary) {
        careerBreakState.primary.baseSalary *= 1 + income.meritIncreaseRate;
        currentSalary = careerBreakState.primary.baseSalary * careerBreakState.primary.replacementRate;
      } else {
        currentSalary *= 1 + income.meritIncreaseRate;
      }
      if (isCoupleHousehold && income.hasPartner) {
        if (careerBreakState.partner) {
          careerBreakState.partner.baseSalary *= 1 + income.partnerMeritIncreaseRate;
          currentPartnerSalary = careerBreakState.partner.baseSalary * careerBreakState.partner.replacementRate;
        } else {
          currentPartnerSalary *= 1 + income.partnerMeritIncreaseRate;
        }
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
    let primaryMonthlyLabour = 0;
    let partnerMonthlyLabour = 0;
    const partnerIncomeActive = isCoupleHousehold && income.hasPartner;
    if (!isRetired) {
      primaryMonthlyGross = currentSalary / 12;
      primaryMonthlyLabour = currentSalary / 12;
      // Holiday allowance (spread over 12 months for simplicity)
      const primaryHolidayAllowance = (currentSalary * income.holidayAllowance) / 12;
      primaryMonthlyGross += primaryHolidayAllowance;
      primaryMonthlyLabour += primaryHolidayAllowance;
      // 13th month
      if (income.thirteenthMonth) {
        const thirteenthAmount = income.thirteenthMonthAmount > 0 ? income.thirteenthMonthAmount : currentSalary / 12;
        primaryMonthlyGross += thirteenthAmount / 12; // Spread over year
        primaryMonthlyLabour += thirteenthAmount / 12;
      }
      // Bonus
      primaryMonthlyGross += income.bonusAmount / 12;
      primaryMonthlyLabour += income.bonusAmount / 12;

      // Partner income
      if (partnerIncomeActive) {
        partnerMonthlyGross += currentPartnerSalary / 12;
        partnerMonthlyLabour += currentPartnerSalary / 12;
        const partnerHolidayAllowance = (currentPartnerSalary * income.partnerHolidayAllowance) / 12;
        partnerMonthlyGross += partnerHolidayAllowance;
        partnerMonthlyLabour += partnerHolidayAllowance;
        // Partner 13th month
        if (income.partnerThirteenthMonth) {
          partnerMonthlyGross += currentPartnerSalary / 12 / 12;
          partnerMonthlyLabour += currentPartnerSalary / 12 / 12;
        }
        // Partner bonus
        partnerMonthlyGross += (income.partnerBonusAmount ?? 0) / 12;
        partnerMonthlyLabour += (income.partnerBonusAmount ?? 0) / 12;
      }

      // Rental income from properties (attributed to primary)
      for (const prop of currentProperties) {
        if (!prop.isOwnerOccupied && prop.rentalIncome > 0) {
          primaryMonthlyGross += prop.rentalIncome;
        }
      }

      // Side income (attributed to primary)
      for (const side of income.sideIncomes) {
        switch (side.frequency) {
          case 'monthly':
            primaryMonthlyGross += side.grossAmount;
            primaryMonthlyLabour += side.grossAmount;
            break;
          case 'quarterly':
            primaryMonthlyGross += side.grossAmount / 3;
            primaryMonthlyLabour += side.grossAmount / 3;
            break;
          case 'annual':
            primaryMonthlyGross += side.grossAmount / 12;
            primaryMonthlyLabour += side.grossAmount / 12;
            break;
        }
      }

      monthlyGrossIncome = primaryMonthlyGross + partnerMonthlyGross;
    } else {
      // Retirement income
      if (currentAge >= aowAge) {
        primaryMonthlyGross += retirement.aowMonthlyAmount;
        if (isCoupleHousehold) {
          partnerMonthlyGross += partnerAowMonthlyAmount;
        }
      }
      if (currentAge >= pensionStartAge) {
        primaryMonthlyGross += pensionMonthly;
        if (isCoupleHousehold) {
          partnerMonthlyGross += partnerPensionMonthly;
        }
      }
      monthlyGrossIncome = primaryMonthlyGross + partnerMonthlyGross;
    }

    const scheduledTaxAdvantagedPayouts = getCurrentTaxAdvantagedPayouts({
      accounts,
      balances: investmentBalances,
      currentDate,
      currentAge,
      settings,
      isCoupleHousehold,
    });
    const scheduledTaxAdvantagedIncome = scheduledTaxAdvantagedPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    if (scheduledTaxAdvantagedIncome > 0) {
      primaryMonthlyGross += scheduledTaxAdvantagedIncome;
      monthlyGrossIncome += scheduledTaxAdvantagedIncome;
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
    monthlyExpenses += householdExpenseAdjustment * inflationFactor;
    if (careerBreakState.primary) monthlyExpenses += careerBreakState.primary.monthlyExpenseChange * inflationFactor;
    if (careerBreakState.partner) monthlyExpenses += careerBreakState.partner.monthlyExpenseChange * inflationFactor;
    // Partner healthcare (only when partner is active)
    if (isCoupleHousehold) {
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
      for (const arrangement of getChildcareArrangements(child)) {
        if (isChildcareArrangementEligible(arrangement, child, currentDate)) {
          monthlyExpenses += arrangement.hoursPerMonth * arrangement.hourlyRate * inflationFactor;
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
    let totalScheduledMortgagePayment = 0;
    let totalExtraMortgageRepayment = 0;
    let totalMortgageInterest = 0;
    let totalDeductibleMortgageInterest = 0;
    let totalMortgagePrincipal = 0;
    let totalMortgageBalance = 0;
    let totalPropertyValue = 0;
    let totalWozValue = 0;
    // Box 3 tracking: only non-owner-occupied properties & their mortgages
    let box3PropertyValue = 0;
    let box3MortgageDebt = 0;

    for (const prop of currentProperties) {
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
          totalScheduledMortgagePayment += payment;
          totalExtraMortgageRepayment += extraPrincipal;
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
      const currentPropertyValue = getPropertyValueAtDate(prop, currentDate);
      totalPropertyValue += currentPropertyValue;
      totalWozValue += prop.wozValue * (currentPropertyValue / Math.max(prop.value, 1));

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
    const annualPrimaryLabour = primaryMonthlyLabour * 12;
    const annualPartnerLabour = partnerMonthlyLabour * 12;
    const annualLabourIncome = annualPrimaryLabour + annualPartnerLabour;
    const annualMortgageInterest = totalDeductibleMortgageInterest * 12;
    const ewf = currentProperties.reduce(
      (sum, p) => sum + (p.isOwnerOccupied ? calculateEigenwoningforfait(p.wozValue, tax) : 0), 0
    );

    // Determine eligibility for additional heffingskortingen
    const hasChildUnder12 = allChildren.some((c) => {
      const childBirth = new Date(c.birthDate);
      const childAge = (currentDate.getTime() - childBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return childAge >= 0 && childAge < 12;
    });
    const isAOWAge = currentAge >= retirement.aowStartAge;
    const isSingle = !isCoupleHousehold;

    // Partner income splitting: when filing as couple, calculate tax for each partner separately
    let monthlyNetIncome: number;
    if (isCoupleHousehold && tax.filingType === 'couple' && annualPartnerGross > 0) {
      // Primary: gets mortgage deduction, EWF, self-employment, box2
      const primaryTax = calculateAnnualNetIncome(annualPrimaryGross, annualMortgageInterest, ewf, tax, {
        labourIncome: annualPrimaryLabour,
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
        labourIncome: annualPartnerLabour,
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
        labourIncome: annualLabourIncome,
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
    const totalSavingsBalance = getSavingsBalance();
    const totalTaxableInvestmentValueForTax = getTaxableInvestmentBalance();
    const annualBox3Tax = calculateBox3Tax(
      totalSavingsBalance,
      totalTaxableInvestmentValueForTax,
      box3MortgageDebt,
      tax,
      tax.filingType === 'couple',
      box3PropertyValue,
    );
    const monthlyBox3Tax = annualBox3Tax / 12;
    monthlyNetIncome -= monthlyBox3Tax;

    // ---- Toeslagen (government benefits) ----
    const totalWealth = totalSavingsBalance + totalTaxableInvestmentValueForTax;

    const toeslagenResult = calculateAnnualToeslagen(
      annualGrossIncome,
      totalWealth,
      allChildren.filter((c) => {
        const childAge = (currentDate.getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return childAge >= 0 && childAge < 18;
      }),
      currentDate,
      isCoupleHousehold,
      !isCoupleHousehold,
      scenario.toeslagen,
    );
    const monthlyToeslagen = toeslagenResult.total / 12;

    // ---- Investment growth ----
    // Only invest if not retired (or if retired, don't contribute)
    const adjustedAccounts = accounts.map(acc => ({
      ...acc,
      monthlyContribution: isRetired ? 0 : acc.monthlyContribution,
    }));

    const portfolioResult = calculatePortfolioMonth(adjustedAccounts, investmentBalances, month);
    for (const [id, bal] of portfolioResult.newBalances) {
      investmentBalances.set(id, bal);
    }

    for (const payout of scheduledTaxAdvantagedPayouts) {
      const balance = investmentBalances.get(payout.accountId) ?? 0;
      const actualPayout = Math.min(balance, payout.amount);
      if (actualPayout > 0) {
        investmentBalances.set(payout.accountId, balance - actualPayout);
      }
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
          const fromSavings = withdrawFromSavings(remaining, emergencyFund);
          remaining -= fromSavings;

          const typePriority: Array<InvestmentAccount['type']> = ['brokerage', 'real-estate'];
          for (const accType of typePriority) {
            if (remaining <= 0) break;
            for (const acc of accounts) {
              if (remaining <= 0) break;
              if (acc.type !== accType) continue;
              const bal = investmentBalances.get(acc.id) ?? 0;
              const draw = Math.min(remaining, bal);
              if (draw > 0) {
                investmentBalances.set(acc.id, bal - draw);
                remaining -= draw;
                if (accType === 'lijfrente') {
                  taxAdvantagedWithdrawals += draw;
                }
              }
            }
          }
          withdrawals = deficit - remaining;
        } else {
          // Proportional withdrawal across liquid accounts only.
          const liquidAccounts = accounts.filter((account) => account.type === 'savings' || isTaxableInvestmentAccount(account));
          let totalLiquidAssets = 0;
          for (const account of liquidAccounts) {
            totalLiquidAssets += investmentBalances.get(account.id) ?? 0;
          }

          if (totalLiquidAssets > 0) {
            for (const account of liquidAccounts) {
              const bal = investmentBalances.get(account.id) ?? 0;
              const share = bal / totalLiquidAssets;
              const draw = withdrawals * share;
              investmentBalances.set(account.id, Math.max(0, bal - draw));
            }
            withdrawals = deficit;
          }
        }
      }
    }

    // ---- Cash flow ----
    const totalMonthlyIncome = monthlyNetIncome + monthlyToeslagen + withdrawals;
    const grossCashFlow = totalMonthlyIncome - monthlyExpenses - totalMortgagePayment;

    // Ring-fence the emergency fund: cap contributions so savings stays above the target.
    const maxContributions = Math.max(0, getSavingsBalance() + grossCashFlow - emergencyFund);
    const actualContributions = Math.min(portfolioResult.totalContributions, maxContributions);
    // If contributions were capped, scale back investment balances proportionally
    if (actualContributions < portfolioResult.totalContributions && portfolioResult.totalContributions > 0) {
      const scale = actualContributions / portfolioResult.totalContributions;
      for (const acc of accounts) {
        if (acc.monthlyContribution > 0 && !isRetired) {
          const currentBal = investmentBalances.get(acc.id) ?? 0;
          const fullContrib = acc.monthlyContribution;
          const reduction = fullContrib * (1 - scale);
          investmentBalances.set(acc.id, Math.max(0, currentBal - reduction));
        }
      }
    }

    const actualContributionScale = portfolioResult.totalContributions > 0
      ? actualContributions / portfolioResult.totalContributions
      : 1;
    const actualCashContributions = portfolioResult.cashContributions * actualContributionScale;
    const actualInvestmentContributions = portfolioResult.investmentContributions * actualContributionScale;

    const monthlyNetCashFlow = grossCashFlow - actualContributions;
    applyAutoSweepCashFlow(monthlyNetCashFlow, emergencyFund);

    // ---- Net worth ----
    const totalInvestmentValue = getInvestedAssetBalance();
    const taxableInvestmentValue = getTaxableInvestmentBalance();
    const savingsBalance = getSavingsBalance();
    const liquidAssetValue = totalInvestmentValue + savingsBalance;
    const netWorth = liquidAssetValue + totalPropertyValue - totalMortgageBalance;
    const liquidNetWorth = liquidAssetValue;

    // ---- Savings rate ----
    const savingsRate = totalMonthlyIncome > 0
      ? (totalMonthlyIncome - monthlyExpenses - totalMortgagePayment) / totalMonthlyIncome
      : 0;

    // ---- FIRE check ----
    const currentRetirementCapitalTarget = calculateRetirementCapitalTarget({
      currentAge,
      desiredAnnualSpending: retirement.desiredAnnualSpending * Math.pow(1 + inflationRate, m / 12),
      safeWithdrawalRate: retirement.safeWithdrawalRate,
      pensionStartAge,
      annualPensionIncome: pensionMonthly * 12,
      aowStartAge: aowAge,
      annualAowIncome: getAnnualAowIncome(isCoupleHousehold),
      additionalIncomePhases: getTaxAdvantagedIncomePhases(currentDate, currentAge),
    });
    if (!fireDate && liquidAssetValue >= currentRetirementCapitalTarget) {
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
      savings: monthlyNetCashFlow + actualContributions,
      investmentValue: totalInvestmentValue,
      investmentGains: portfolioResult.investmentGrowth,
      propertyValue: totalPropertyValue,
      mortgageBalance: totalMortgageBalance,
      netWorth,
      liquidNetWorth,
      savingsRate,
      cashBalance: savingsBalance,
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
        totalScheduledMortgagePayments: 0,
        totalExtraMortgageRepayments: 0,
        totalMortgagePayments: 0,
        totalCashContributions: 0,
        totalInvestmentContributions: 0,
        cashReturns: 0,
        investmentReturns: 0,
        endNetWorth: 0,
        endLiquidNetWorth: 0,
        endInvestmentValue: 0,
        endTaxableInvestmentValue: 0,
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
    (annual as any).primaryLabour = ((annual as any).primaryLabour ?? 0) + primaryMonthlyLabour;
    (annual as any).partnerLabour = ((annual as any).partnerLabour ?? 0) + partnerMonthlyLabour;
    annual.totalExpenses! += monthlyExpenses;
    annual.totalScheduledMortgagePayments! += totalScheduledMortgagePayment;
    annual.totalExtraMortgageRepayments! += totalExtraMortgageRepayment;
    annual.totalMortgagePayments! += totalMortgagePayment;
    annual.totalCashContributions! += actualCashContributions;
    annual.totalInvestmentContributions! += actualInvestmentContributions;
    annual.cashReturns! += portfolioResult.cashGrowth;
    annual.investmentReturns! += portfolioResult.investmentGrowth;
    annual.totalToeslagen! += monthlyToeslagen;
    annual.mortgageInterest = (annual.mortgageInterest ?? 0) + totalMortgageInterest;
    annual.eigenwoningforfait = ewf;
    annual.endNetWorth = netWorth;
    annual.endLiquidNetWorth = liquidNetWorth;
    annual.endInvestmentValue = totalInvestmentValue;
    annual.endTaxableInvestmentValue = taxableInvestmentValue;
    annual.endPropertyValue = totalPropertyValue;
    annual.endMortgageBalance = totalMortgageBalance;
    annual.endCashBalance = savingsBalance;
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
    const primaryLabourAnnual = (data as any).primaryLabour ?? ((data as any).primaryGross ?? gross);
    const partnerLabourAnnual = (data as any).partnerLabour ?? 0;
    const totalLabourAnnual = primaryLabourAnnual + partnerLabourAnnual;

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
        labourIncome: primaryLabourAnnual,
        hasChildUnder12: annualHasChildUnder12,
        isAOWAge: annualIsAOWAge,
        isSingle: false,
        isJonggehandicapt: tax.jonggehandicaptEnabled,
        currentYear: data.year!,
        box2Income: income.box2Income ?? 0,
        hasSelfEmployment: income.sideIncomes.some((si) => si.isSelfEmployed),
      });
      const partnerTax = calculateAnnualNetIncome(partnerGrossAnnual, 0, 0, tax, {
        labourIncome: partnerLabourAnnual,
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
        labourIncome: totalLabourAnnual,
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
      data.endTaxableInvestmentValue ?? 0,
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
      totalScheduledMortgagePayments: data.totalScheduledMortgagePayments!,
      totalExtraMortgageRepayments: data.totalExtraMortgageRepayments!,
      totalMortgagePayments: data.totalMortgagePayments!,
      totalCashContributions: data.totalCashContributions!,
      totalInvestmentContributions: data.totalInvestmentContributions!,
      cashReturns: data.cashReturns!,
      investmentReturns: data.investmentReturns!,
      endNetWorth: data.endNetWorth!,
      endLiquidNetWorth: data.endLiquidNetWorth!,
      endInvestmentValue: data.endInvestmentValue!,
      endTaxableInvestmentValue: data.endTaxableInvestmentValue!,
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
  const avgReturn = accounts.length > 0
    ? accounts.reduce((s, a) => s + a.expectedReturn, 0) / accounts.length
    : 0.07;
  const yearsToRetirement = Math.max(0, retirementAge - startAge);
  const fireNumberAtRetirement = calculateRetirementCapitalTarget({
    currentAge: retirementAge,
    desiredAnnualSpending: retirement.desiredAnnualSpending * Math.pow(1 + inflationRate, yearsToRetirement),
    safeWithdrawalRate: retirement.safeWithdrawalRate,
    pensionStartAge,
    annualPensionIncome: pensionMonthly * 12,
    aowStartAge: aowAge,
    annualAowIncome: getAnnualAowIncome(tax.filingType === 'couple'),
  });
  const coastFireAmount = calculateCoastFire(fireNumberAtRetirement, yearsToRetirement, avgReturn);
  let totalCurrentInvestments = 0;
  for (const acc of accounts) totalCurrentInvestments += acc.balance;
  const coastFireAge = totalCurrentInvestments >= coastFireAmount
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
  onSalaryChange: (event: LifeEvent) => void;
  onPartnerChange: (event: LifeEvent) => void;
  onLumpSum: (amount: number) => void;
  onCareerBreak: (event: LifeEvent) => void;
  onChildBorn: (event: LifeEvent) => void;
  onBuyProperty: (event: LifeEvent) => void;
  onSellProperty: (event: LifeEvent) => void;
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
          handlers.onSalaryChange(event);
          break;
        case 'cash_windfall':
          handlers.onLumpSum(event.cashAmount ?? 0);
          break;
        case 'partner_change':
          handlers.onPartnerChange(event);
          break;
        case 'one_time_expense':
          handlers.onLumpSum(-(event.cashAmount ?? 0));
          break;
        case 'buy_property':
          handlers.onBuyProperty(event);
          break;
        case 'sell_property':
          handlers.onSellProperty(event);
          break;
        case 'child_born':
          handlers.onChildBorn(event);
          break;
        case 'career_break':
          handlers.onCareerBreak(event);
          break;
      }
    }
  }
}
