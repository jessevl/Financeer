import { describe, it, expect } from 'vitest';
import { runSimulation } from './simulation';
import { taxPreset2025 } from '@/data/taxPresets';
import { toeslagenPreset2025 } from '@/data/toeslagenPresets';
import type { Scenario, GlobalSettings, TaxConfig, ToeslagenConfig } from '@/types';

// ---- Helpers ----

const defaultTax: TaxConfig = {
  filingType: 'single',
  presetYear: 2025,
  ...taxPreset2025,
};

const defaultToeslagen: ToeslagenConfig = {
  enabled: false,
  presetYear: 2025,
  ...toeslagenPreset2025,
};

const defaultSettings: GlobalSettings = {
  theme: 'light',
  themeVariant: 'warm',
  accentColor: 'default',
  currency: 'EUR',
  locale: 'nl-NL',
  inflationRate: 0.02,
  showRealValues: false,
  simulationEndAge: 70,
  dateOfBirth: '1990-01-01',
  taxLawYear: 2025,
  onboardingCompleted: true,
  dismissedHints: [],
};

function makeScenario(overrides?: Partial<Scenario>): Scenario {
  return {
    id: 'test',
    name: 'Test Scenario',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    income: {
      grossSalary: 60000,
      holidayAllowance: 0.08,
      thirteenthMonth: false,
      thirteenthMonthAmount: 0,
      bonusAmount: 0,
      meritIncreaseRate: 0,
      hasPartner: false,
      partnerGrossSalary: 0,
      partnerHolidayAllowance: 0.08,
      partnerMeritIncreaseRate: 0,
      partnerThirteenthMonth: false,
      partnerBonusAmount: 0,
      box2Income: 0,
      sideIncomes: [],
      careerEvents: [],
    },
    tax: defaultTax,
    expenses: {
      monthlyFixed: [],
      monthlyVariable: [],
      annualExpenses: [],
      children: [],
      healthcareMonthlyPremium: 150,
      healthcareDeductible: 385,
      partnerHealthcareMonthlyPremium: 0,
      partnerHealthcareDeductible: 0,
      oneOffExpenses: [],
    },
    housing: { properties: [] },
    investments: {
      currentSavings: 10000,
      emergencyFund: 5000,
      accounts: [],
    },
    retirement: {
      targetAge: 65,
      pensionStartAge: 67,
      desiredAnnualSpending: 30000,
      safeWithdrawalRate: 0.04,
      aowStartAge: 67,
      aowMonthlyAmount: 1400,
      pensionMonthlyAmount: 0,
      withdrawalStrategy: 'proportional',
    },
    toeslagen: defaultToeslagen,
    lifeEvents: [],
    ...overrides,
  };
}

// ================================================================
// Basic simulation smoke test
// ================================================================
describe('runSimulation — basics', () => {
  it('produces monthly snapshots', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    expect(result.months.length).toBeGreaterThan(0);
  });

  it('produces annual summaries', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    expect(result.annualSummaries.length).toBeGreaterThan(0);
  });

  it('calculates FIRE number', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    // 30000 / 0.04 = 750000
    expect(result.fireNumber).toBe(750000);
  });

  it('first year gross income includes holiday allowance', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    const year1 = result.annualSummaries[0];
    // Gross salary 60k + 8% holiday = 64,800
    expect(year1.grossIncome).toBeCloseTo(64800, -2);
  });

  it('first year net income is positive and less than gross', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    const year1 = result.annualSummaries[0];
    expect(year1.netIncome).toBeGreaterThan(0);
    expect(year1.netIncome).toBeLessThan(year1.grossIncome);
  });

  it('effective tax rate is reasonable (20-40%)', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    const year1 = result.annualSummaries[0];
    expect(year1.effectiveTaxRate).toBeGreaterThanOrEqual(0.2);
    expect(year1.effectiveTaxRate).toBeLessThanOrEqual(0.4);
  });
});

// ================================================================
// Couple filing — each partner gets separate brackets
// ================================================================
describe('runSimulation — couple filing', () => {
  it('produces per-partner tax breakdowns', () => {
    const scenario = makeScenario({
      income: {
        grossSalary: 60000,
        holidayAllowance: 0.08,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: true,
        partnerGrossSalary: 40000,
        partnerHolidayAllowance: 0.08,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      tax: { ...defaultTax, filingType: 'couple' },
    });

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];

    expect(year1.primaryTax).toBeDefined();
    expect(year1.partnerTax).toBeDefined();
  });

  it('each partner starts at bracket 1', () => {
    const scenario = makeScenario({
      income: {
        grossSalary: 60000,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: true,
        partnerGrossSalary: 40000,
        partnerHolidayAllowance: 0,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      tax: { ...defaultTax, filingType: 'couple' },
    });

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];

    // Primary gross: 60k, partner gross: 40k
    // Both should be taxed starting from bracket 1
    expect(year1.primaryTax!.grossIncome).toBeCloseTo(60000, -2);
    expect(year1.partnerTax!.grossIncome).toBeCloseTo(40000, -2);

    // Partner's effective rate should be lower than primary's (lower income)
    expect(year1.partnerTax!.effectiveRate).toBeLessThan(year1.primaryTax!.effectiveRate);
  });

  it('couple filing is more tax-efficient than pooled income', () => {
    // Couple scenario
    const coupleScenario = makeScenario({
      income: {
        grossSalary: 60000,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: true,
        partnerGrossSalary: 40000,
        partnerHolidayAllowance: 0,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      tax: { ...defaultTax, filingType: 'couple' },
    });

    // Single person earning combined 100k
    const singleScenario = makeScenario({
      income: {
        grossSalary: 100000,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: false,
        partnerGrossSalary: 0,
        partnerHolidayAllowance: 0.08,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      tax: { ...defaultTax, filingType: 'single' },
    });

    const coupleResult = runSimulation(coupleScenario, defaultSettings);
    const singleResult = runSimulation(singleScenario, defaultSettings);
    const coupleYear1 = coupleResult.annualSummaries[0];
    const singleYear1 = singleResult.annualSummaries[0];

    // Couple with split incomes should pay less total tax
    expect(coupleYear1.netIncome).toBeGreaterThan(singleYear1.netIncome);
  });
});

// ================================================================
// IACK flag propagation (bug fix verification)
// ================================================================
describe('runSimulation — IACK in annual summary', () => {
  it('shows IACK credit when child under 12 exists', () => {
    const scenario = makeScenario({
      income: {
        grossSalary: 60000,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: true,
        partnerGrossSalary: 40000,
        partnerHolidayAllowance: 0,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      tax: { ...defaultTax, filingType: 'couple' },
      expenses: {
        monthlyFixed: [],
        monthlyVariable: [],
        annualExpenses: [],
        children: [
          {
            id: 'child1',
            name: 'Child',
            birthDate: '2020-06-15',
            monthlyExpense: 200,
            kinderopvangType: 'none',
            kinderopvangHoursPerMonth: 0,
            kinderopvangHourlyRate: 0,
          },
        ],
        healthcareMonthlyPremium: 150,
        healthcareDeductible: 385,
        partnerHealthcareMonthlyPremium: 150,
        partnerHealthcareDeductible: 385,
        oneOffExpenses: [],
      },
    });

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];

    // Lower earner (partner) should get IACK
    expect(year1.partnerTax!.iackCredit).toBeGreaterThan(0);
  });
});

// ================================================================
// Retirement transition
// ================================================================
describe('runSimulation — retirement', () => {
  it('income drops at retirement age', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1975-01-01', // age ~50 in 2025 → plenty of pre-retirement years
      simulationEndAge: 70,
    };

    const scenario = makeScenario({
      retirement: {
        targetAge: 65,
        pensionStartAge: 65,
        desiredAnnualSpending: 30000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 67,
        aowMonthlyAmount: 1400,
        pensionMonthlyAmount: 500,
        withdrawalStrategy: 'proportional',
      },
    });

    const result = runSimulation(scenario, settings);

    // Find years before and after retirement
    const preRetirement = result.annualSummaries.find((s) => s.age >= 60 && s.age < 65);
    const postRetirement = result.annualSummaries.find((s) => s.age >= 66 && s.age < 67);

    expect(preRetirement).toBeDefined();
    expect(postRetirement).toBeDefined();
    // Gross income should be lower after retirement (no salary, only pension)
    expect(postRetirement!.grossIncome).toBeLessThan(preRetirement!.grossIncome);
  });

  it('AOW kicks in at AOW age', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1958-01-01',
      simulationEndAge: 70,
    };

    const scenario = makeScenario({
      retirement: {
        targetAge: 65,
        pensionStartAge: 65,
        desiredAnnualSpending: 30000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 67,
        aowMonthlyAmount: 1400,
        pensionMonthlyAmount: 500,
        withdrawalStrategy: 'proportional',
      },
    });

    const result = runSimulation(scenario, settings);

    // At age 67+, income should include AOW (1400*12 = 16800/yr)
    const aowYear = result.annualSummaries.find((s) => s.age >= 68);
    if (aowYear) {
      // Should have at least AOW + pension gross income
      expect(aowYear.grossIncome).toBeGreaterThanOrEqual(12 * (1400 + 500) * 0.9); // allow some rounding
    }
  });

  it('employer pension starts at retirement age before AOW', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1980-01-01',
      simulationEndAge: 70,
    };

    const scenario = makeScenario({
      income: {
        grossSalary: 60000,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: false,
        partnerGrossSalary: 0,
        partnerHolidayAllowance: 0,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      retirement: {
        targetAge: 62,
        pensionStartAge: 62,
        desiredAnnualSpending: 30000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 67,
        aowMonthlyAmount: 1400,
        pensionMonthlyAmount: 500,
        withdrawalStrategy: 'proportional',
      },
    });

    const result = runSimulation(scenario, settings);
    const yearBetweenRetAndAow = result.annualSummaries.find((s) => s.age >= 63 && s.age < 67);

    expect(yearBetweenRetAndAow).toBeDefined();
    expect(yearBetweenRetAndAow!.grossIncome).toBeGreaterThanOrEqual(12 * 500 * 0.9);
  });

  it('still applies Box 2 tax after retirement', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1940-01-01',
      simulationEndAge: 95,
    };

    const scenario = makeScenario({
      income: {
        grossSalary: 0,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: false,
        partnerGrossSalary: 0,
        partnerHolidayAllowance: 0,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 10000,
        sideIncomes: [],
        careerEvents: [],
      },
      retirement: {
        targetAge: 55,
        pensionStartAge: 67,
        desiredAnnualSpending: 30000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 67,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'proportional',
      },
    });

    const result = runSimulation(scenario, settings);
    const year = result.annualSummaries[0];

    expect(year.primaryTax).toBeDefined();
    expect(year.primaryTax!.box2Tax).toBeGreaterThan(0);
  });

  it('deducts Box 3 tax from retirement cashflow', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1940-01-01',
      simulationEndAge: 95,
    };

    const scenario = makeScenario({
      income: {
        grossSalary: 0,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: false,
        partnerGrossSalary: 0,
        partnerHolidayAllowance: 0,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      investments: {
        currentSavings: 1_000_000,
        emergencyFund: 0,
        accounts: [],
      },
      tax: {
        ...defaultTax,
        box3: {
          ...defaultTax.box3,
          freeThreshold: 0,
        },
      },
      retirement: {
        targetAge: 55,
        pensionStartAge: 67,
        desiredAnnualSpending: 0,
        safeWithdrawalRate: 0.04,
        aowStartAge: 67,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'proportional',
      },
    });

    const result = runSimulation(scenario, settings);
    const year = result.annualSummaries[0];

    expect(year.taxBox3).toBeGreaterThan(0);
    expect(year.netIncome).toBeLessThan(0);
  });
});

// ================================================================
// Mortgage integration
// ================================================================
describe('runSimulation — mortgage', () => {
  it('mortgage balance decreases for annuity type', () => {
    const scenario = makeScenario({
      housing: {
        properties: [
          {
            id: 'prop1',
            label: 'Home',
            value: 400000,
            appreciationRate: 0.03,
            wozValue: 380000,
            isOwnerOccupied: true,
            rentalIncome: 0,
            mortgages: [
              {
                id: 'mtg1',
                label: 'Mortgage',
                type: 'annuity',
                principal: 320000,
                interestRate: 0.04,
                fixedRatePeriod: 30,
                variableRateAfter: 0.05,
                termYears: 30,
                startDate: '2020-01-01',
                deductibilityStartDate: '2020-01-01',
                extraRepayments: [],
                nhg: false,
              },
            ],
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);

    // Mortgage balance should decrease year over year
    const year1 = result.annualSummaries[0];
    const year5 = result.annualSummaries[4];

    if (year5) {
      expect(year5.endMortgageBalance).toBeLessThan(year1.endMortgageBalance);
    }
  });

  it('mortgage interest provides tax deduction', () => {
    const withMortgage = makeScenario({
      housing: {
        properties: [
          {
            id: 'prop1',
            label: 'Home',
            value: 400000,
            appreciationRate: 0.03,
            wozValue: 380000,
            isOwnerOccupied: true,
            rentalIncome: 0,
            mortgages: [
              {
                id: 'mtg1',
                label: 'Mortgage',
                type: 'annuity',
                principal: 320000,
                interestRate: 0.04,
                fixedRatePeriod: 30,
                variableRateAfter: 0.05,
                termYears: 30,
                startDate: '2020-01-01',
                deductibilityStartDate: '2020-01-01',
                extraRepayments: [],
                nhg: false,
              },
            ],
          },
        ],
      },
    });
    const withoutMortgage = makeScenario();

    const r1 = runSimulation(withMortgage, defaultSettings);
    const r2 = runSimulation(withoutMortgage, defaultSettings);

    // With mortgage interest deduction → lower effective tax rate
    expect(r1.annualSummaries[0].effectiveTaxRate).toBeLessThan(
      r2.annualSummaries[0].effectiveTaxRate,
    );
  });
});

// ================================================================
// Investment growth
// ================================================================
describe('runSimulation — investments', () => {
  it('investment accounts grow over time', () => {
    const scenario = makeScenario({
      investments: {
        currentSavings: 10000,
        emergencyFund: 5000,
        accounts: [
          {
            id: 'acc1',
            name: 'ETF Portfolio',
            type: 'brokerage',
            balance: 50000,
            monthlyContribution: 500,
            expectedReturn: 0.07,
            volatility: 0,
            expenseRatio: 0.002,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];
    const year10 = result.annualSummaries[9];

    if (year10) {
      expect(year10.endInvestmentValue).toBeGreaterThan(year1.endInvestmentValue);
    }
  });
});

// ================================================================
// Net worth tracking
// ================================================================
describe('runSimulation — net worth', () => {
  it('net worth grows over time for saver', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    const year1 = result.annualSummaries[0];
    const yearLast = result.annualSummaries[result.annualSummaries.length - 1];
    expect(yearLast.endNetWorth).toBeGreaterThan(year1.endNetWorth);
  });

  it('liquid net worth excludes property equity', () => {
    const scenario = makeScenario({
      housing: {
        properties: [
          {
            id: 'prop1',
            label: 'Home',
            value: 400000,
            appreciationRate: 0.02,
            wozValue: 380000,
            isOwnerOccupied: true,
            rentalIncome: 0,
            mortgages: [
              {
                id: 'mtg1',
                label: 'Mortgage',
                type: 'annuity',
                principal: 320000,
                interestRate: 0.04,
                fixedRatePeriod: 30,
                variableRateAfter: 0.05,
                termYears: 30,
                startDate: '2020-01-01',
                deductibilityStartDate: '2020-01-01',
                extraRepayments: [],
                nhg: false,
              },
            ],
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];

    // Net worth includes property, liquid net worth does not
    expect(year1.endNetWorth).toBeGreaterThan(year1.endLiquidNetWorth);
  });
});
