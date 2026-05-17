import { v4 as uuidv4 } from 'uuid';
import type {
  Scenario,
  GlobalSettings,
  IncomeConfig,
  TaxConfig,
  ExpenseConfig,
  HousingConfig,
  InvestmentConfig,
  InvestmentAccount,
  RetirementConfig,
  ToeslagenConfig,
} from '@/types';
import { taxPreset2025 } from './taxPresets';
import { toeslagenPreset2025 } from './toeslagenPresets';

export const defaultGlobalSettings: GlobalSettings = {
  theme: 'system',
  themeVariant: 'warm',
  accentColor: 'coral',
  currency: 'EUR',
  locale: 'nl-NL',
  inflationRate: 0.025,
  showRealValues: false,
  simulationEndAge: 90,
  dateOfBirth: '1990-01-01',
  partnerDateOfBirth: '',
  lifeExpectancyAge: 90,
  partnerLifeExpectancyAge: 90,
  taxLawYear: 2025,
  onboardingCompleted: false,
  dismissedHints: [],
};

export const defaultIncome: IncomeConfig = {
  grossSalary: 55000,
  holidayAllowance: 0.08,
  thirteenthMonth: false,
  thirteenthMonthAmount: 0,
  bonusAmount: 0,
  meritIncreaseRate: 0.025,
  hasPartner: false,
  partnerGrossSalary: 0,
  partnerHolidayAllowance: 0.08,
  partnerMeritIncreaseRate: 0.02,
  partnerThirteenthMonth: false,
  partnerBonusAmount: 0,
  box2Income: 0,
  sideIncomes: [],
  careerEvents: [],
};

export const defaultTax: TaxConfig = {
  filingType: 'single',
  presetYear: 2025,
  ...taxPreset2025,
};

export const defaultExpenses: ExpenseConfig = {
  monthlyFixed: [
    { id: uuidv4(), label: 'Utilities', amount: 200, category: 'Housing' },
    { id: uuidv4(), label: 'Insurance', amount: 150, category: 'Insurance' },
    { id: uuidv4(), label: 'Subscriptions', amount: 50, category: 'Lifestyle' },
    { id: uuidv4(), label: 'Phone & Internet', amount: 60, category: 'Utilities' },
  ],
  monthlyVariable: [
    { id: uuidv4(), label: 'Groceries', amount: 400, category: 'Food' },
    { id: uuidv4(), label: 'Transport', amount: 150, category: 'Transport' },
    { id: uuidv4(), label: 'Entertainment', amount: 100, category: 'Lifestyle' },
    { id: uuidv4(), label: 'Clothing', amount: 75, category: 'Personal' },
  ],
  annualExpenses: [
    { id: uuidv4(), label: 'Holidays', amount: 3000, category: 'Lifestyle' },
    { id: uuidv4(), label: 'Gifts', amount: 500, category: 'Personal' },
  ],
  children: [],
  healthcareMonthlyPremium: 130,
  healthcareDeductible: 385,
  partnerHealthcareMonthlyPremium: 130,
  partnerHealthcareDeductible: 385,
  oneOffExpenses: [],
};

export const defaultHousing: HousingConfig = {
  properties: [
    {
      id: uuidv4(),
      label: 'Primary Residence',
      startDate: '2024-01-01',
      endDate: undefined,
      value: 350000,
      appreciationRate: 0.03,
      mortgages: [
        {
          id: uuidv4(),
          label: 'Mortgage',
          type: 'annuity',
          principal: 280000,
          interestRate: 0.039,
          fixedRatePeriod: 10,
          variableRateAfter: 0.05,
          termYears: 30,
          startDate: '2024-01-01',
          deductibilityStartDate: '2024-01-01',
          extraRepayments: [],
          nhg: false,
        },
      ],
      wozValue: 300000,
      isOwnerOccupied: true,
      rentalIncome: 0,
      purchaseCosts: 0,
      sellingCosts: 0,
      salePrice: undefined,
    },
  ],
};

export function createInvestmentAccount(
  type: InvestmentAccount['type'] = 'brokerage',
  overrides: Partial<InvestmentAccount> = {},
): InvestmentAccount {
  const defaultPayoutStartYear = new Date().getFullYear() + 20;
  const baseByType: Record<InvestmentAccount['type'], Omit<InvestmentAccount, 'id'>> = {
    brokerage: {
      name: 'Index Fund Portfolio',
      type: 'brokerage',
      balance: 0,
      monthlyContribution: 500,
      expectedReturn: 0.07,
      volatility: 0.15,
      expenseRatio: 0.002,
      compoundingFrequency: 'monthly',
      reinvestDividends: true,
      payoutPhase: 'accumulation',
      payoutStartYear: undefined,
      payoutDurationYears: undefined,
      partnerContinuation: false,
    },
    'real-estate': {
      name: 'Real Estate Fund',
      type: 'real-estate',
      balance: 0,
      monthlyContribution: 0,
      expectedReturn: 0.06,
      volatility: 0.12,
      expenseRatio: 0.01,
      compoundingFrequency: 'monthly',
      reinvestDividends: true,
      payoutPhase: 'accumulation',
      payoutStartYear: undefined,
      payoutDurationYears: undefined,
      partnerContinuation: false,
    },
    savings: {
      name: 'Savings Account',
      type: 'savings',
      balance: 0,
      monthlyContribution: 0,
      expectedReturn: 0.02,
      volatility: 0,
      expenseRatio: 0,
      compoundingFrequency: 'monthly',
      reinvestDividends: false,
      payoutPhase: 'accumulation',
      payoutStartYear: undefined,
      payoutDurationYears: undefined,
      partnerContinuation: false,
    },
    lijfrente: {
      name: 'Lijfrente Account',
      type: 'lijfrente',
      balance: 0,
      monthlyContribution: 0,
      expectedReturn: 0.05,
      volatility: 0.08,
      expenseRatio: 0.002,
      compoundingFrequency: 'monthly',
      reinvestDividends: true,
      payoutPhase: 'accumulation',
      payoutStartYear: defaultPayoutStartYear,
      payoutDurationYears: 20,
      partnerContinuation: false,
    },
  };

  return {
    id: overrides.id ?? uuidv4(),
    ...baseByType[type],
    ...overrides,
    type,
    volatility: type === 'savings' ? 0 : (overrides.volatility ?? baseByType[type].volatility),
    expenseRatio: type === 'savings' ? 0 : (overrides.expenseRatio ?? baseByType[type].expenseRatio),
    reinvestDividends: type === 'savings' ? false : (overrides.reinvestDividends ?? baseByType[type].reinvestDividends),
  };
}

export const defaultInvestments: InvestmentConfig = {
  emergencyFund: 5000,
  autoSweepAccountId: undefined,
  accounts: [
    createInvestmentAccount('savings', { balance: 10000 }),
    createInvestmentAccount('brokerage'),
  ],
};

export const defaultRetirement: RetirementConfig = {
  targetAge: 57,
  pensionStartAge: 67,
  desiredAnnualSpending: 36000,
  safeWithdrawalRate: 0.04,
  aowStartAge: 67,
  aowMonthlyAmount: 1380,
  partnerAowMonthlyAmount: 1380,
  pensionMonthlyAmount: 0,
  partnerPensionMonthlyAmount: 0,
  withdrawalStrategy: 'tax-efficient',
  pensionType: 'fixed',
  pensionAccrualRate: 0.01875,
  pensionFranchise: 17545,
  pensionServiceStartAge: 25,
  pensionPartTimeFactor: 1.0,
  pensionEarlyRetirementPenalty: 0.065,
};

export const defaultToeslagen: ToeslagenConfig = {
  enabled: true,
  presetYear: 2025,
  ...toeslagenPreset2025,
};

export function createDefaultScenario(name = 'My Plan'): Scenario {
  const now = new Date().toISOString();
  const investmentAccounts = defaultInvestments.accounts.map(a => ({ ...a, id: uuidv4() }));
  const defaultSweepTarget = investmentAccounts.find((account) => account.type === 'brokerage' || account.type === 'real-estate')?.id;
  return {
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
    income: { ...defaultIncome },
    tax: { ...defaultTax },
    expenses: {
      ...defaultExpenses,
      monthlyFixed: defaultExpenses.monthlyFixed.map(e => ({ ...e, id: uuidv4() })),
      monthlyVariable: defaultExpenses.monthlyVariable.map(e => ({ ...e, id: uuidv4() })),
      annualExpenses: defaultExpenses.annualExpenses.map(e => ({ ...e, id: uuidv4() })),
    },
    housing: { ...defaultHousing },
    investments: {
      ...defaultInvestments,
      autoSweepAccountId: defaultSweepTarget,
      accounts: investmentAccounts,
    },
    retirement: { ...defaultRetirement },
    toeslagen: { ...defaultToeslagen },
    lifeEvents: [],
  };
}
