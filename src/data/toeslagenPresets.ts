import type { ToeslagenConfig } from '@/types';

export const toeslagenPreset2025: Omit<ToeslagenConfig, 'enabled' | 'presetYear'> = {
  zorgtoeslag: {
    enabled: true,
    standaardpremie: 1928,
    drempelinkomen: 25725,
    drempelPercentageSingle: 0.01896,
    drempelPercentageCouple: 0.04273,
    excessPercentage: 0.137,
    vermogensGrensSingle: 141896,
    vermogensGrensCouple: 179429,
  },
  kindgebondenBudget: {
    enabled: true,
    basePerChild: 2511,
    supplement12to15: 703,
    supplement16to17: 936,
    singleParentExtra: 3389,
    drempelinkomen: 25725,
    coupleExtraThreshold: 9139,
    reductionRate: 0.071,
  },
  kinderbijslag: {
    enabled: true,
    quarterly0to5: 291.49,
    quarterly6to11: 353.95,
    quarterly12to17: 416.41,
  },
  kinderopvangtoeslag: {
    enabled: false,
    maxHourlyRateDaycare: 10.71,
    maxHourlyRateBso: 9.65,
    maxHourlyRateGastouder: 8.17,
    maxHoursPerMonth: 230,
    firstChildPercentage: 0.68,
    secondChildPercentage: 0.95,
    incomeThresholdLow: 29470,
    incomeThresholdHigh: 155890,
    minPercentage: 0.3367,
    maxPercentage: 0.96,
  },
  huurtoeslag: {
    enabled: false,
    monthlyRent: 0,
    basishuur: 200.09,
    aftoppingsgrens: 650.43,
    maxHuur: 879.66,
    maxInkomenSingle: 35116,
    maxInkomenCouple: 44655,
    vermogensGrens: 36952,
  },
};

export const toeslagenPreset2024: Omit<ToeslagenConfig, 'enabled' | 'presetYear'> = {
  zorgtoeslag: {
    enabled: true,
    standaardpremie: 1889,
    drempelinkomen: 25070,
    drempelPercentageSingle: 0.01896,
    drempelPercentageCouple: 0.04273,
    excessPercentage: 0.137,
    vermogensGrensSingle: 127582,
    vermogensGrensCouple: 161329,
  },
  kindgebondenBudget: {
    enabled: true,
    basePerChild: 2394,
    supplement12to15: 671,
    supplement16to17: 892,
    singleParentExtra: 3227,
    drempelinkomen: 25070,
    coupleExtraThreshold: 8700,
    reductionRate: 0.068,
  },
  kinderbijslag: {
    enabled: true,
    quarterly0to5: 281.69,
    quarterly6to11: 342.03,
    quarterly12to17: 402.36,
  },
  kinderopvangtoeslag: {
    enabled: false,
    maxHourlyRateDaycare: 10.25,
    maxHourlyRateBso: 9.12,
    maxHourlyRateGastouder: 7.93,
    maxHoursPerMonth: 230,
    firstChildPercentage: 0.68,
    secondChildPercentage: 0.95,
    incomeThresholdLow: 28722,
    incomeThresholdHigh: 152800,
    minPercentage: 0.3367,
    maxPercentage: 0.96,
  },
  huurtoeslag: {
    enabled: false,
    monthlyRent: 0,
    basishuur: 187.97,
    aftoppingsgrens: 633.25,
    maxHuur: 879.66,
    maxInkomenSingle: 33748,
    maxInkomenCouple: 42836,
    vermogensGrens: 36952,
  },
};

// 2026 stub — actual rates not yet published; falls back to 2025
export const toeslagenPreset2026: Omit<ToeslagenConfig, 'enabled' | 'presetYear'> = {
  ...toeslagenPreset2025,
};

export function getToeslagenPreset(year: number) {
  switch (year) {
    case 2024: return toeslagenPreset2024;
    case 2026: return toeslagenPreset2026;
    default: return toeslagenPreset2025;
  }
}
