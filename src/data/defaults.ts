import { v4 as uuidv4 } from 'uuid';
import type {
  Scenario,
  GlobalSettings,
  IncomeConfig,
  TaxConfig,
  ExpenseConfig,
  HousingConfig,
  InvestmentConfig,
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
    },
  ],
};

export const defaultInvestments: InvestmentConfig = {
  currentSavings: 10000,
  emergencyFund: 5000,
  accounts: [
    {
      id: uuidv4(),
      name: 'Index Fund Portfolio',
      type: 'brokerage',
      balance: 0,
      monthlyContribution: 500,
      expectedReturn: 0.07,
      volatility: 0.15,
      expenseRatio: 0.002,
      compoundingFrequency: 'monthly',
      reinvestDividends: true,
    },
  ],
};

export const defaultRetirement: RetirementConfig = {
  targetAge: 57,
  pensionStartAge: 67,
  desiredAnnualSpending: 36000,
  safeWithdrawalRate: 0.04,
  aowStartAge: 67,
  aowMonthlyAmount: 1380,
  pensionMonthlyAmount: 0,
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
      accounts: defaultInvestments.accounts.map(a => ({ ...a, id: uuidv4() })),
    },
    retirement: { ...defaultRetirement },
    toeslagen: { ...defaultToeslagen },
    lifeEvents: [],
  };
}
