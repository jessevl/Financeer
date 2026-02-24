import type { TaxConfig } from '@/types';

export const taxPreset2025: Omit<TaxConfig, 'filingType' | 'presetYear'> = {
  box1Brackets: [
    { upperLimit: 38441, rate: 0.3697 },
    { upperLimit: 76817, rate: 0.3697 },
    { upperLimit: null, rate: 0.495 },
  ],
  generalTaxCredit: {
    maxAmount: 3362,
    phaseOutStart: 24813,
    phaseOutEnd: 75518,
  },
  labourTaxCredit: {
    maxAmount: 5599,
    minAmount: 69,
    buildUpStart: 11491,
    buildUpEnd: 39958,
    phaseOutStart: 39958,
    phaseOutEnd: 124935,
    buildUpSegments: [
      { upTo: 24821, rate: 0.08231, baseAmount: 0 },
      { upTo: 39958, rate: 0.29861, baseAmount: 1098 },
    ],
  },
  box2: {
    lowerRate: 0.245,
    lowerBracketLimit: 67000,
    upperRate: 0.33,
  },
  box3: {
    freeThreshold: 57000,
    savingsRate: 0.0036,
    investmentRate: 0.0604,
    debtRate: 0.0247,
    debtThreshold: 3700,
    taxRate: 0.36,
  },
  socialContributions: {
    zvwRate: 0.0565,
    zvwMaxIncome: 71628,
  },
  eigenwoningforfaitRate: 0.0035,
  eigenwoningforfaitThreshold: 1310000,
  iack: {
    maxAmount: 2694,
    incomeThreshold: 5876,
    buildUpRate: 0.1145,
  },
  ouderenkorting: {
    maxAmount: 1955,
    phaseOutStart: 44770,
    phaseOutRate: 0.15,
    alleenstaandAmount: 524,
  },
  jonggehandicaptenkorting: 820,
  jonggehandicaptEnabled: false,
  selfEmployment: {
    zelfstandigenaftrek: 5030,
    mkbWinstvrijstelling: 0.1331,
    startersaftrek: 2123,
    isStarter: false,
  },
  taxOptimizations: {
    lijfrenteAnnualContribution: 0,
    jaarruimteMaxIncome: 137800,
    jaarruimtePercent: 0.133,
    jaarruimteThreshold: 17545,
    jaarruimteMax: 15986,
    factorA: 0,
    hillenEnabled: true,
    hillenStartYear: 2019,
    hillenPhaseOutYears: 30,
    giftenRegular: 0,
    giftenPeriodiek: 0,
    giftenThresholdPercent: 0.01,
    giftenMaxPercent: 0.10,
    greenInvestments: 0,
    greenExemptionPerPerson: 71251,
    greenTaxCredit: 0.007,
    alimentatie: 0,
  },
};

export const taxPreset2024: Omit<TaxConfig, 'filingType' | 'presetYear'> = {
  box1Brackets: [
    { upperLimit: 75518, rate: 0.3693 },
    { upperLimit: null, rate: 0.495 },
  ],
  generalTaxCredit: {
    maxAmount: 3362,
    phaseOutStart: 24813,
    phaseOutEnd: 75518,
  },
  labourTaxCredit: {
    maxAmount: 5158,
    buildUpStart: 11491,
    buildUpEnd: 37691,
    phaseOutStart: 37691,
    phaseOutEnd: 121094,
  },
  box2: {
    lowerRate: 0.245,
    lowerBracketLimit: 67000,
    upperRate: 0.33,
  },
  box3: {
    freeThreshold: 57000,
    savingsRate: 0.0092,
    investmentRate: 0.0633,
    debtRate: 0.0247,
    debtThreshold: 3700,
    taxRate: 0.36,
  },
  socialContributions: {
    zvwRate: 0.0565,
    zvwMaxIncome: 68714,
  },
  eigenwoningforfaitRate: 0.0035,
  eigenwoningforfaitThreshold: 1310000,
  iack: {
    maxAmount: 2534,
    incomeThreshold: 5547,
    buildUpRate: 0.1145,
  },
  ouderenkorting: {
    maxAmount: 1735,
    phaseOutStart: 40888,
    phaseOutRate: 0.15,
    alleenstaandAmount: 524,
  },
  jonggehandicaptenkorting: 820,
  jonggehandicaptEnabled: false,
  selfEmployment: {
    zelfstandigenaftrek: 3750,
    mkbWinstvrijstelling: 0.1331,
    startersaftrek: 2123,
    isStarter: false,
  },
  taxOptimizations: {
    lijfrenteAnnualContribution: 0,
    jaarruimteMaxIncome: 130428,
    jaarruimtePercent: 0.133,
    jaarruimteThreshold: 16322,
    jaarruimteMax: 15167,
    factorA: 0,
    hillenEnabled: true,
    hillenStartYear: 2019,
    hillenPhaseOutYears: 30,
    giftenRegular: 0,
    giftenPeriodiek: 0,
    giftenThresholdPercent: 0.01,
    giftenMaxPercent: 0.10,
    greenInvestments: 0,
    greenExemptionPerPerson: 65072,
    greenTaxCredit: 0.007,
    alimentatie: 0,
  },
};

// 2026 stub — actual Belastingplan 2026 rates not yet published; falls back to 2025
export const taxPreset2026: Omit<TaxConfig, 'filingType' | 'presetYear'> = {
  ...taxPreset2025,
};

export function getTaxPreset(year: number) {
  switch (year) {
    case 2024: return taxPreset2024;
    case 2026: return taxPreset2026;
    default: return taxPreset2025;
  }
}
