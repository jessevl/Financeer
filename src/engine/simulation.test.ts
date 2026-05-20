import { describe, it, expect } from 'vitest';
import { runSimulation } from './simulation';
import { calculateRetirementCapitalTarget, solveEquivalentConstantWithdrawalRate } from './simulation';
import { getMortgageSnapshotAtDate } from './mortgage';
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
  partnerDateOfBirth: '',
  lifeExpectancyAge: 90,
  partnerLifeExpectancyAge: 90,
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
      retirementTargetMode: 'manual',
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
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const currentAge = (startOfYear.getTime() - new Date(defaultSettings.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const expected = (30000 * (67 - currentAge)) + ((30000 - 1400 * 12) / 0.04);

    expect(result.fireNumber).toBeCloseTo(expected, 0);
  });

  it('maps legacy manual mode to the SWR calculation method', () => {
    const result = runSimulation(makeScenario(), defaultSettings);
    expect(result.retirementCalculationMethod).toBe('swr');
    expect(result.retirementTargetMode).toBe('manual');
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

  it('uses couple AOW rules even when partner income is disabled', () => {
    const baseScenario = makeScenario();
    const settings = {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      simulationEndAge: 90,
    };

    const scenario = makeScenario({
      income: {
        ...baseScenario.income,
        hasPartner: false,
      },
      tax: {
        ...defaultTax,
        filingType: 'couple',
      },
      retirement: {
        ...baseScenario.retirement,
        targetAge: 67,
        pensionStartAge: 90,
        aowStartAge: 67,
        aowMonthlyAmount: 950,
        pensionMonthlyAmount: 0,
      },
    });

    const result = runSimulation(scenario, settings);

    expect(result.annualSummaries[0].grossIncome).toBeCloseTo(950 * 12 * 2, -2);
  });

  it('uses separate partner AOW amounts when configured', () => {
    const baseScenario = makeScenario();
    const settings = {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      simulationEndAge: 90,
    };

    const scenario = makeScenario({
      income: {
        ...baseScenario.income,
        hasPartner: false,
      },
      tax: {
        ...defaultTax,
        filingType: 'couple',
      },
      retirement: {
        ...baseScenario.retirement,
        targetAge: 67,
        pensionStartAge: 90,
        aowStartAge: 67,
        aowMonthlyAmount: 1000,
        partnerAowMonthlyAmount: 800,
        pensionMonthlyAmount: 0,
      } as any,
    });

    const result = runSimulation(scenario, settings);

    expect(result.annualSummaries[0].grossIncome).toBeCloseTo((1000 + 800) * 12, -2);
  });

  it('treats the configured couple AOW amount as a per-person amount', () => {
    const baseScenario = makeScenario();
    const settings = {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      simulationEndAge: 90,
    };

    const scenario = makeScenario({
      income: {
        ...baseScenario.income,
        hasPartner: false,
      },
      tax: {
        ...defaultTax,
        filingType: 'couple',
      },
      retirement: {
        ...baseScenario.retirement,
        targetAge: 67,
        pensionStartAge: 90,
        aowStartAge: 67,
        aowMonthlyAmount: 950,
        pensionMonthlyAmount: 0,
      },
    });

    const result = runSimulation(scenario, settings);

    expect(result.annualSummaries[0].grossIncome).toBeCloseTo(950 * 12 * 2, -2);
  });

  it('does not apply labour tax credit to pension-only retirement income', () => {
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
      retirement: {
        targetAge: 55,
        pensionStartAge: 67,
        desiredAnnualSpending: 12000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 90,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 1000,
        withdrawalStrategy: 'proportional',
      },
    });

    const result = runSimulation(scenario, settings);

    expect(result.annualSummaries[0].primaryTax?.labourCredit ?? 0).toBe(0);
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

  it('uses separate partner employer pension amounts when configured', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      simulationEndAge: 90,
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
      tax: {
        ...defaultTax,
        filingType: 'couple',
      },
      retirement: {
        targetAge: 67,
        pensionStartAge: 67,
        desiredAnnualSpending: 30000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 90,
        aowMonthlyAmount: 0,
        partnerAowMonthlyAmount: 0,
        pensionMonthlyAmount: 1200,
        partnerPensionMonthlyAmount: 700,
        withdrawalStrategy: 'proportional',
      } as any,
    });

    const result = runSimulation(scenario, settings);

    expect(result.annualSummaries[0].grossIncome).toBeCloseTo((1200 + 700) * 12, -2);
  });

  it('aligns FIRE age with the first crossing when partner pension lowers the target', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1968-01-01',
      partnerDateOfBirth: '1968-01-01',
      simulationEndAge: 80,
      inflationRate: 0.025,
    };

    const scenario = makeScenario({
      income: {
        grossSalary: 80000,
        holidayAllowance: 0,
        thirteenthMonth: false,
        thirteenthMonthAmount: 0,
        bonusAmount: 0,
        meritIncreaseRate: 0,
        hasPartner: true,
        partnerGrossSalary: 80000,
        partnerHolidayAllowance: 0,
        partnerMeritIncreaseRate: 0,
        partnerThirteenthMonth: false,
        partnerBonusAmount: 0,
        box2Income: 0,
        sideIncomes: [],
        careerEvents: [],
      },
      tax: {
        ...defaultTax,
        filingType: 'couple',
      },
      investments: {
        currentSavings: 500000,
        emergencyFund: 0,
        accounts: [
          {
            id: 'broker1',
            name: 'Brokerage',
            type: 'brokerage',
            balance: 950000,
            monthlyContribution: 0,
            expectedReturn: 0.05,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
      retirement: {
        targetAge: 60,
        pensionStartAge: 67,
        retirementTargetMode: 'manual',
        desiredAnnualSpending: 60000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 90,
        aowMonthlyAmount: 0,
        partnerAowMonthlyAmount: 0,
        pensionMonthlyAmount: 1200,
        partnerPensionMonthlyAmount: 1200,
        withdrawalStrategy: 'tax-efficient',
      } as any,
    });

    const result = runSimulation(scenario, settings);
    const expectedCrossing = result.months.find((month) => {
      const movingTarget = calculateRetirementCapitalTarget({
        currentAge: month.age,
        desiredAnnualSpending: scenario.retirement.desiredAnnualSpending * Math.pow(1 + settings.inflationRate, month.month / 12),
        safeWithdrawalRate: scenario.retirement.safeWithdrawalRate,
        pensionStartAge: scenario.retirement.pensionStartAge,
        annualPensionIncome: (scenario.retirement.pensionMonthlyAmount + (scenario.retirement.partnerPensionMonthlyAmount ?? 0)) * 12,
        aowStartAge: scenario.retirement.aowStartAge,
        annualAowIncome: 0,
      });

      return month.liquidNetWorth >= movingTarget;
    });

    expect(expectedCrossing).toBeDefined();
    expect(result.fireAge).not.toBeNull();
    expect(result.fireAge!).toBeCloseTo(expectedCrossing!.age, 6);
  });

  it('uses the retirement capital target in derived mode instead of the discounted on-track requirement', () => {
    const settings: GlobalSettings = {
      ...defaultSettings,
      simulationEndAge: 90,
    };

    const scenario = makeScenario({
      income: {
        grossSalary: 100000,
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
      expenses: {
        ...makeScenario().expenses,
        monthlyFixed: [{ id: 'rent', label: 'Housing', amount: 2200, category: 'housing' }],
        monthlyVariable: [{ id: 'living', label: 'Living', amount: 1200, category: 'living' }],
      },
      investments: {
        currentSavings: 20000,
        emergencyFund: 5000,
        accounts: [
          {
            id: 'broker1',
            name: 'Brokerage',
            type: 'brokerage',
            balance: 30000,
            monthlyContribution: 0,
            expectedReturn: 0.05,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
      retirement: {
        targetAge: 50,
        pensionStartAge: 67,
        retirementTargetMode: 'derived',
        desiredAnnualSpending: 50000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 90,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'proportional',
      } as any,
    });

    const result = runSimulation(scenario, settings);
    const expectedCrossing = result.months.find((month) => month.liquidNetWorth >= result.fireNumber);
    const retirementStartOfYear = new Date(new Date().getFullYear(), 0, 1);
    const currentAge = (retirementStartOfYear.getTime() - new Date(settings.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const yearsToRetirement = Math.max(0, scenario.retirement.targetAge - currentAge);

    expect(result.retirementTargetMode).toBe('derived');
    expect(result.fireNumber).toBeCloseTo(result.derivedRetirementCapitalRequirement, 6);
    expect(result.fireNumber).toBeGreaterThan(result.currentLiquidNetWorth);
    expect(result.equivalentConstantWithdrawalRate).not.toBeNull();
    expect(calculateRetirementCapitalTarget({
      currentAge: scenario.retirement.targetAge,
      desiredAnnualSpending: scenario.retirement.desiredAnnualSpending * Math.pow(1 + settings.inflationRate, yearsToRetirement),
      safeWithdrawalRate: result.equivalentConstantWithdrawalRate!,
      pensionStartAge: scenario.retirement.pensionStartAge,
      annualPensionIncome: 0,
      aowStartAge: scenario.retirement.aowStartAge,
      annualAowIncome: 0,
    })).toBeCloseTo(result.fireNumber, 2);
    if (expectedCrossing) {
      expect(expectedCrossing.month).toBeGreaterThan(0);
      expect(result.fireAge).not.toBeNull();
      expect(result.fireAge!).toBeCloseTo(expectedCrossing.age, 6);
    } else {
      expect(result.fireAge).toBeNull();
    }
  });

  it('uses a lower target for die-with-zero than for perpetual SWR when legacy is low', () => {
    const baseRetirement = {
      targetAge: 55,
      pensionStartAge: 67,
      desiredAnnualSpending: 50000,
      safeWithdrawalRate: 0.04,
      aowStartAge: 90,
      aowMonthlyAmount: 0,
      pensionMonthlyAmount: 0,
      withdrawalStrategy: 'proportional' as const,
    };

    const swrResult = runSimulation(makeScenario({
      retirement: {
        ...baseRetirement,
        retirementCalculationMethod: 'swr',
        retirementTargetMode: 'manual',
      } as any,
    }), defaultSettings);

    const dwzResult = runSimulation(makeScenario({
      retirement: {
        ...baseRetirement,
        retirementCalculationMethod: 'die-with-zero',
        retirementTargetMode: 'derived',
        legacyTargetAmount: 0,
      } as any,
    }), defaultSettings);

    expect(dwzResult.retirementCalculationMethod).toBe('die-with-zero');
    expect(dwzResult.fireNumber).toBeLessThan(swrResult.fireNumber);
  });

  it('solves equivalent constant withdrawal rates above 100% when the manual shortcut still has a finite match', () => {
    const currentAge = 50;
    const desiredAnnualSpending = 50000;
    const pensionStartAge = 67;
    const annualPensionIncome = 45000;
    const aowStartAge = 90;
    const annualAowIncome = 0;
    const bridgeCapital = calculateRetirementCapitalTarget({
      currentAge,
      desiredAnnualSpending,
      safeWithdrawalRate: 1_000_000,
      pensionStartAge,
      annualPensionIncome,
      aowStartAge,
      annualAowIncome,
    });
    const targetCapital = bridgeCapital + 2500;

    const result = solveEquivalentConstantWithdrawalRate({
      targetCapital,
      currentAge,
      desiredAnnualSpending,
      pensionStartAge,
      annualPensionIncome,
      aowStartAge,
      annualAowIncome,
    });

    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(1);
    expect(calculateRetirementCapitalTarget({
      currentAge,
      desiredAnnualSpending,
      safeWithdrawalRate: result!,
      pensionStartAge,
      annualPensionIncome,
      aowStartAge,
      annualAowIncome,
    })).toBeCloseTo(targetCapital, 2);
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
            startDate: '2020-01-01',
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

  it('tracks extra repayments separately from scheduled mortgage payments', () => {
    const currentYear = new Date().getFullYear();
    const scenario = makeScenario({
      housing: {
        properties: [
          {
            id: 'prop1',
            label: 'Home',
            startDate: `${currentYear}-01-01`,
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
                startDate: `${currentYear}-01-01`,
                deductibilityStartDate: `${currentYear}-01-01`,
                extraRepayments: [{ id: 'rep1', date: `${currentYear}-01-01`, amount: 10000 }],
                nhg: false,
              },
            ],
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];

    expect(year1.totalExtraMortgageRepayments).toBe(10000);
    expect(year1.totalScheduledMortgagePayments).toBeGreaterThan(0);
    expect(year1.totalMortgagePayments).toBeCloseTo(
      year1.totalScheduledMortgagePayments + year1.totalExtraMortgageRepayments,
      6,
    );
  });

  it('uses the opening outstanding balance for mortgages that started before the simulation year', () => {
    const currentYear = new Date().getFullYear();
    const mortgage = {
      id: 'mtg1',
      label: 'Mortgage',
      type: 'annuity' as const,
      principal: 338420,
      interestRate: 0.015,
      fixedRatePeriod: 20,
      variableRateAfter: 0.05,
      termYears: 27,
      startDate: `${currentYear - 4}-01-01`,
      deductibilityStartDate: `${currentYear - 4}-01-01`,
      extraRepayments: [],
      nhg: false,
    };
    const scenario = makeScenario({
      housing: {
        properties: [
          {
            id: 'prop1',
            label: 'Home',
            startDate: '2020-01-01',
            value: 400000,
            appreciationRate: 0.03,
            wozValue: 380000,
            isOwnerOccupied: true,
            rentalIncome: 0,
            mortgages: [mortgage],
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];
    const openingSnapshot = getMortgageSnapshotAtDate(mortgage, new Date(currentYear, 0, 1));

    expect(year1.totalScheduledMortgagePayments).toBeCloseTo(openingSnapshot.currentPayment * 12, 6);
  });

  it('mortgage interest provides tax deduction', () => {
    const withMortgage = makeScenario({
      housing: {
        properties: [
          {
            id: 'prop1',
            label: 'Home',
            startDate: '2020-01-01',
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

  it('savings accounts earn interest and flow through endCashBalance', () => {
    const scenario = makeScenario({
      investments: {
        emergencyFund: 0,
        accounts: [
          {
            id: 'sav1',
            name: 'Savings Account',
            type: 'savings',
            balance: 10000,
            monthlyContribution: 0,
            expectedReturn: 0.024,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);

    expect(result.annualSummaries[0].endCashBalance).toBeGreaterThan(10000);
  });

  it('keeps invested assets, cash savings, and liquid net worth internally consistent', () => {
    const scenario = makeScenario({
      investments: {
        emergencyFund: 5000,
        accounts: [
          {
            id: 'sav1',
            name: 'Savings Account',
            type: 'savings',
            balance: 10000,
            monthlyContribution: 150,
            expectedReturn: 0.02,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
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

    expect(year1.endInvestmentValue).toBeCloseTo(year1.endLiquidNetWorth - year1.endCashBalance, 6);
    expect(year1.totalCashContributions).toBeGreaterThan(0);
    expect(year1.totalInvestmentContributions).toBeGreaterThan(0);
    expect(year1.cashReturns).toBeGreaterThan(0);
    expect(year1.investmentReturns).toBeGreaterThan(0);
  });

  it('sweeps monthly surplus into the selected account after the emergency fund is filled', () => {
    const scenario = makeScenario({
      investments: {
        emergencyFund: 5000,
        autoSweepAccountId: 'broker1',
        accounts: [
          {
            id: 'sav1',
            name: 'Savings Account',
            type: 'savings',
            balance: 5000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
          {
            id: 'broker1',
            name: 'Brokerage',
            type: 'brokerage',
            balance: 1000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);

    expect(result.annualSummaries[0].endCashBalance).toBeCloseTo(5000, 0);
    expect(result.annualSummaries[0].endTaxableInvestmentValue).toBeGreaterThan(1000);
  });

  it('fills the emergency fund before sweeping remaining surplus into the selected account', () => {
    const scenario = makeScenario({
      investments: {
        emergencyFund: 5000,
        autoSweepAccountId: 'broker1',
        accounts: [
          {
            id: 'sav1',
            name: 'Savings Account',
            type: 'savings',
            balance: 1000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
          {
            id: 'broker1',
            name: 'Brokerage',
            type: 'brokerage',
            balance: 1000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);

    expect(result.annualSummaries[0].endCashBalance).toBeGreaterThanOrEqual(5000);
    expect(result.annualSummaries[0].endTaxableInvestmentValue).toBeGreaterThan(1000);
  });

  it('can sweep surplus into a chosen savings account after the emergency fund is filled', () => {
    const scenario = makeScenario({
      investments: {
        emergencyFund: 5000,
        autoSweepAccountId: 'sav2',
        accounts: [
          {
            id: 'sav1',
            name: 'Emergency Savings',
            type: 'savings',
            balance: 5000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
          {
            id: 'sav2',
            name: 'Goal Savings',
            type: 'savings',
            balance: 1000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);

    expect(result.annualSummaries[0].endCashBalance).toBeGreaterThan(6000);
    expect(result.annualSummaries[0].endTaxableInvestmentValue).toBe(0);
  });

  it('excludes lijfrente assets from Box 3 wealth tax', () => {
    const scenario = makeScenario({
      investments: {
        emergencyFund: 0,
        accounts: [
          {
            id: 'sav1',
            name: 'Savings Account',
            type: 'savings',
            balance: 0,
            monthlyContribution: 0,
            expectedReturn: 0.02,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
          {
            id: 'l1',
            name: 'Lijfrente Account',
            type: 'lijfrente',
            balance: 100000,
            monthlyContribution: 0,
            expectedReturn: 0.05,
            volatility: 0.08,
            expenseRatio: 0.002,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
    });

    const result = runSimulation(scenario, defaultSettings);

    expect(result.annualSummaries[0].taxBox3).toBe(0);
  });

  it('taxes brokered real-estate investments in Box 3 like other non-primary-residence investments', () => {
    const scenario = makeScenario({
      investments: {
        emergencyFund: 0,
        accounts: [
          {
            id: 'sav1',
            name: 'Savings Account',
            type: 'savings',
            balance: 0,
            monthlyContribution: 0,
            expectedReturn: 0.02,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
          {
            id: 're1',
            name: 'Brokered Real Estate',
            type: 'real-estate',
            balance: 100000,
            monthlyContribution: 0,
            expectedReturn: 0.06,
            volatility: 0.12,
            expenseRatio: 0.01,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
      tax: {
        ...defaultTax,
        box3: {
          ...defaultTax.box3,
          freeThreshold: 0,
        },
      },
    });

    const result = runSimulation(scenario, defaultSettings);

    expect(result.annualSummaries[0].taxBox3).toBeGreaterThan(0);
    expect(result.annualSummaries[0].endTaxableInvestmentValue).toBeGreaterThan(100000);
  });

  it('starts fixed-term lijfrente payouts in the configured start year and stops after the chosen duration', () => {
    const currentYear = new Date().getFullYear();
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      simulationEndAge: 90,
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
        emergencyFund: 0,
        accounts: [
          {
            id: 'lij1',
            name: 'Lijfrente',
            type: 'lijfrente',
            balance: 120000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
            payoutPhase: 'fixed-term',
            payoutStartYear: currentYear,
            payoutDurationYears: 10,
            partnerContinuation: false,
          } as any,
        ],
      },
      retirement: {
        targetAge: 55,
        pensionStartAge: 90,
        desiredAnnualSpending: 0,
        safeWithdrawalRate: 0.04,
        aowStartAge: 90,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'proportional',
      },
    });

    const result = runSimulation(scenario, settings);
    const firstYear = result.annualSummaries.find((summary) => summary.year === currentYear);
    const afterTerm = result.annualSummaries.find((summary) => summary.year === currentYear + 11);

    expect(firstYear?.grossIncome ?? 0).toBeCloseTo(12000, -2);
    expect(afterTerm?.grossIncome ?? 0).toBe(0);
  });

  it('reduces lifetime payout income when partner continuation is enabled', () => {
    const currentYear = new Date().getFullYear();
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      partnerDateOfBirth: '1960-01-01',
      lifeExpectancyAge: 82,
      partnerLifeExpectancyAge: 95,
      simulationEndAge: 95,
    };

    const baseScenario = makeScenario({
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
      tax: {
        ...defaultTax,
        filingType: 'couple',
      },
      investments: {
        emergencyFund: 0,
        accounts: [
          {
            id: 'pen1',
            name: 'Lijfrente Pot',
            type: 'lijfrente',
            balance: 120000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
            payoutPhase: 'lifetime',
            payoutStartYear: currentYear,
            payoutDurationYears: 0,
            partnerContinuation: false,
          } as any,
        ],
      },
      retirement: {
        targetAge: 55,
        pensionStartAge: 90,
        desiredAnnualSpending: 0,
        safeWithdrawalRate: 0.04,
        aowStartAge: 95,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'proportional',
      },
    });

    const withPartnerContinuation = runSimulation({
      ...baseScenario,
      investments: {
        ...baseScenario.investments,
        accounts: baseScenario.investments.accounts.map((account) => ({
          ...account,
          partnerContinuation: true,
        })) as any,
      },
    }, settings);
    const withoutPartnerContinuation = runSimulation(baseScenario, settings);

    expect(withPartnerContinuation.annualSummaries[0].grossIncome).toBeGreaterThan(0);
    expect(withPartnerContinuation.annualSummaries[0].grossIncome).toBeLessThan(withoutPartnerContinuation.annualSummaries[0].grossIncome);
  });

  it('uses partner age and mortality assumptions for survivor continuation horizon', () => {
    const currentYear = new Date().getFullYear();
    const baseScenario = makeScenario({
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
      tax: {
        ...defaultTax,
        filingType: 'couple',
      },
      investments: {
        emergencyFund: 0,
        accounts: [
          {
            id: 'pen1',
            name: 'Lijfrente Pot',
            type: 'lijfrente',
            balance: 180000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
            payoutPhase: 'lifetime',
            payoutStartYear: currentYear,
            payoutDurationYears: 0,
            partnerContinuation: true,
          } as any,
        ],
      },
      retirement: {
        targetAge: 55,
        pensionStartAge: 90,
        desiredAnnualSpending: 0,
        safeWithdrawalRate: 0.04,
        aowStartAge: 95,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'proportional',
      },
    });

    const shorterSurvivorHorizon = runSimulation(baseScenario, {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      partnerDateOfBirth: '1948-01-01',
      lifeExpectancyAge: 82,
      partnerLifeExpectancyAge: 83,
      simulationEndAge: 95,
    });

    const longerSurvivorHorizon = runSimulation(baseScenario, {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      partnerDateOfBirth: '1960-01-01',
      lifeExpectancyAge: 82,
      partnerLifeExpectancyAge: 95,
      simulationEndAge: 105,
    });

    expect(longerSurvivorHorizon.annualSummaries[0].grossIncome).toBeLessThan(shorterSurvivorHorizon.annualSummaries[0].grossIncome);
  });

  it('reduces taxable-account drawdown once lijfrente payouts start', () => {
    const currentYear = new Date().getFullYear();
    const settings: GlobalSettings = {
      ...defaultSettings,
      dateOfBirth: '1950-01-01',
      simulationEndAge: 90,
    };

    const makeWithdrawalScenario = (payoutStartYear: number) => makeScenario({
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
      expenses: {
        monthlyFixed: [],
        monthlyVariable: [],
        annualExpenses: [],
        children: [],
        healthcareMonthlyPremium: 0,
        healthcareDeductible: 0,
        partnerHealthcareMonthlyPremium: 0,
        partnerHealthcareDeductible: 0,
        oneOffExpenses: [],
      },
      investments: {
        emergencyFund: 0,
        accounts: [
          {
            id: 'sav1',
            name: 'Savings Account',
            type: 'savings',
            balance: 0,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
          },
          {
            id: 'bro1',
            name: 'Brokerage',
            type: 'brokerage',
            balance: 120000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
          {
            id: 'lij1',
            name: 'Lijfrente',
            type: 'lijfrente',
            balance: 120000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
            payoutPhase: 'fixed-term',
            payoutStartYear,
            payoutDurationYears: 10,
            partnerContinuation: false,
          } as any,
        ],
      },
      retirement: {
        targetAge: 55,
        pensionStartAge: 90,
        desiredAnnualSpending: 12000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 95,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'tax-efficient',
      },
    });

    const payoutNow = runSimulation(makeWithdrawalScenario(currentYear), settings);
    const payoutLater = runSimulation(makeWithdrawalScenario(currentYear + 20), settings);

    expect(payoutNow.annualSummaries[0].endTaxableInvestmentValue).toBeGreaterThan(payoutLater.annualSummaries[0].endTaxableInvestmentValue);
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

  it('liquid net worth excludes owner-occupied home equity', () => {
    const scenario = makeScenario({
      housing: {
        properties: [
          {
            id: 'prop1',
            label: 'Home',
            startDate: '2020-01-01',
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

    // Total net worth includes the home you live in, liquid net worth does not.
    expect(year1.endNetWorth).toBeGreaterThan(year1.endLiquidNetWorth);
  });

  it('liquid net worth includes non-owner-occupied property equity', () => {
    const scenario = makeScenario({
      housing: {
        properties: [
          {
            id: 'rental-1',
            label: 'Rental',
            startDate: '2020-01-01',
            value: 400000,
            appreciationRate: 0,
            wozValue: 400000,
            isOwnerOccupied: false,
            rentalIncome: 0,
            mortgages: [
              {
                id: 'rental-mtg-1',
                label: 'Rental Mortgage',
                type: 'interest-only',
                principal: 250000,
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

    expect(year1.endLiquidNetWorth).toBeGreaterThan(100000);
    expect(year1.endNetWorth).toBeCloseTo(year1.endLiquidNetWorth, 6);
  });
});

describe('runSimulation — life events', () => {
  it('calculates career breaks from salary and replacement rate', () => {
    const currentYear = new Date().getFullYear();
    const scenario = makeScenario({
      income: {
        grossSalary: 120000,
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
      expenses: {
        monthlyFixed: [],
        monthlyVariable: [],
        annualExpenses: [],
        children: [],
        healthcareMonthlyPremium: 0,
        healthcareDeductible: 0,
        partnerHealthcareMonthlyPremium: 0,
        partnerHealthcareDeductible: 0,
        oneOffExpenses: [],
      },
      lifeEvents: [
        {
          id: 'break1',
          type: 'career_break',
          date: `${currentYear}-07`,
          label: 'Parental leave',
          durationMonths: 6,
          incomeReplacementRate: 0.5,
          monthlyExpenseChange: 0,
          isPartner: false,
        },
      ],
    });

    const result = runSimulation(scenario, defaultSettings);
    expect(result.annualSummaries[0].grossIncome).toBeCloseTo(90000, 6);
  });

  it('bridges pre-retirement cash shortfalls from investments before applying returns', () => {
    const currentYear = new Date().getFullYear();
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
        careerEvents: [
          {
            id: 'break1',
            date: `${currentYear}-01`,
            label: 'Early retirement bridge',
            isPartner: false,
            type: 'career_break',
            durationMonths: 12,
            incomeReplacementRate: 0,
            monthlyExpenseChange: 0,
          },
        ],
      },
      expenses: {
        monthlyFixed: [{ id: 'fixed-1', label: 'Living costs', amount: 2000, category: 'core' }],
        monthlyVariable: [],
        annualExpenses: [],
        children: [],
        healthcareMonthlyPremium: 0,
        healthcareDeductible: 0,
        partnerHealthcareMonthlyPremium: 0,
        partnerHealthcareDeductible: 0,
        oneOffExpenses: [],
      },
      investments: {
        currentSavings: 1000,
        emergencyFund: 0,
        accounts: [
          {
            id: 'broker-1',
            name: 'Bridge portfolio',
            type: 'brokerage',
            balance: 120000,
            monthlyContribution: 0,
            expectedReturn: 0.12,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: true,
          },
        ],
      },
      retirement: {
        targetAge: 67,
        pensionStartAge: 67,
        desiredAnnualSpending: 24000,
        safeWithdrawalRate: 0.04,
        aowStartAge: 67,
        aowMonthlyAmount: 0,
        pensionMonthlyAmount: 0,
        withdrawalStrategy: 'tax-efficient',
      },
    });

    const result = runSimulation(scenario, defaultSettings);
    const untouchedFirstMonthBalance = 120000 * (1 + 0.12 / 12);

    expect(result.months[0].cashBalance).toBeGreaterThanOrEqual(0);
    expect(result.months[0].investmentValue).toBeLessThan(untouchedFirstMonthBalance);
  });

  it('supports salary deltas instead of manual cash impacts', () => {
    const currentYear = new Date().getFullYear();
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
      expenses: {
        monthlyFixed: [],
        monthlyVariable: [],
        annualExpenses: [],
        children: [],
        healthcareMonthlyPremium: 0,
        healthcareDeductible: 0,
        partnerHealthcareMonthlyPremium: 0,
        partnerHealthcareDeductible: 0,
        oneOffExpenses: [],
      },
      lifeEvents: [
        {
          id: 'salary1',
          type: 'salary_change',
          date: `${currentYear}-07`,
          label: 'Promotion',
          isPartner: false,
          salaryChangeMode: 'delta',
          annualSalaryDelta: 12000,
        },
      ],
    });

    const result = runSimulation(scenario, defaultSettings);
    expect(result.annualSummaries[0].grossIncome).toBeCloseTo(66000, 6);
  });

  it('calculates property purchase cash need from price, mortgage, and costs', () => {
    const currentYear = new Date().getFullYear();
    const baseScenario = makeScenario({
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
      housing: { properties: [] },
      expenses: {
        monthlyFixed: [],
        monthlyVariable: [],
        annualExpenses: [],
        children: [],
        healthcareMonthlyPremium: 0,
        healthcareDeductible: 0,
        partnerHealthcareMonthlyPremium: 0,
        partnerHealthcareDeductible: 0,
        oneOffExpenses: [],
      },
      investments: {
        emergencyFund: 0,
        accounts: [
          {
            id: 'sav1',
            name: 'Savings',
            type: 'savings',
            balance: 100000,
            monthlyContribution: 0,
            expectedReturn: 0,
            volatility: 0,
            expenseRatio: 0,
            compoundingFrequency: 'monthly',
            reinvestDividends: false,
            payoutPhase: 'accumulation',
            partnerContinuation: false,
          },
        ],
      },
    });
    const scenario = {
      ...baseScenario,
      lifeEvents: [
        {
          id: 'buy1',
          type: 'buy_property' as const,
          date: `${currentYear}-01`,
          label: 'Rental purchase',
          propertyId: 'property-buy1',
          propertyLabel: 'Rental purchase',
          propertyValue: 300000,
          propertyWozValue: 300000,
          propertyAppreciationRate: 0,
          propertyOwnerOccupied: false,
          propertyRentalIncome: 0,
          propertyPurchaseCosts: 10000,
          propertyMortgages: [
            {
              id: 'mort1',
              label: 'Mortgage',
              type: 'annuity' as const,
              principal: 240000,
              interestRate: 0.04,
              fixedRatePeriod: 10,
              variableRateAfter: 0.05,
              termYears: 30,
              startDate: '',
              deductibilityStartDate: '',
              extraRepayments: [],
              nhg: false,
            },
          ],
        },
      ],
    };

    const result = runSimulation(scenario, defaultSettings);
    const year1 = result.annualSummaries[0];

    expect(year1.endPropertyValue).toBeGreaterThan(0);
    expect(year1.totalScheduledMortgagePayments).toBeGreaterThan(0);
    expect(year1.endCashBalance).toBeLessThan(40000);
  });
});
