import { describe, it, expect } from 'vitest';
import {
  calculateZorgtoeslag,
  calculateKindgebondenBudget,
  calculateKinderbijslag,
  calculateHuurtoeslag,
  calculateKinderopvangtoeslag,
  calculateAnnualToeslagen,
} from './toeslagen';
import { toeslagenPreset2025 } from '@/data/toeslagenPresets';
import type { ToeslagenConfig, ChildConfig } from '@/types';

const config: ToeslagenConfig = {
  enabled: true,
  presetYear: 2025,
  ...toeslagenPreset2025,
};

const now = new Date('2025-06-15');

function makeChild(birthDate: string, overrides?: Partial<ChildConfig>): ChildConfig {
  return {
    id: 'c1',
    name: 'Child',
    birthDate,
    monthlyExpense: 200,
    kinderopvangType: 'none',
    kinderopvangHoursPerMonth: 0,
    kinderopvangHourlyRate: 0,
    ...overrides,
  };
}

// ================================================================
// Zorgtoeslag
// ================================================================
describe('calculateZorgtoeslag', () => {
  it('returns 0 when disabled', () => {
    const disabledConfig = {
      ...config,
      zorgtoeslag: { ...config.zorgtoeslag, enabled: false },
    };
    expect(calculateZorgtoeslag(25000, 0, false, disabledConfig)).toBe(0);
  });

  it('returns positive amount for low-income single', () => {
    const result = calculateZorgtoeslag(20000, 0, false, config);
    expect(result).toBeGreaterThan(0);
  });

  it('returns higher amount for couple (2× standaardpremie)', () => {
    const single = calculateZorgtoeslag(20000, 0, false, config);
    const couple = calculateZorgtoeslag(20000, 0, true, config);
    expect(couple).toBeGreaterThan(single);
  });

  it('returns 0 for high income', () => {
    expect(calculateZorgtoeslag(60000, 0, false, config)).toBe(0);
  });

  it('returns 0 when wealth exceeds limit', () => {
    expect(calculateZorgtoeslag(20000, 200000, false, config)).toBe(0);
  });

  it('formula: premie - normpremie', () => {
    const income = 25000;
    const zt = config.zorgtoeslag;
    const normpremie =
      zt.drempelPercentageSingle * zt.drempelinkomen +
      zt.excessPercentage * Math.max(0, income - zt.drempelinkomen);
    const expected = Math.max(0, zt.standaardpremie - normpremie);
    expect(calculateZorgtoeslag(income, 0, false, config)).toBeCloseTo(expected, 2);
  });
});

// ================================================================
// Kindgebonden Budget
// ================================================================
describe('calculateKindgebondenBudget', () => {
  it('returns 0 with no children', () => {
    expect(calculateKindgebondenBudget(30000, [], now, false, false, config)).toBe(0);
  });

  it('returns base per child for low income', () => {
    const children = [makeChild('2020-01-01')];
    const result = calculateKindgebondenBudget(20000, children, now, false, false, config);
    expect(result).toBeCloseTo(2511, 0); // basePerChild, below threshold → no reduction
  });

  it('adds age supplement for 12-15', () => {
    const children = [makeChild('2012-01-01')]; // age 13 in Jun 2025
    const result = calculateKindgebondenBudget(20000, children, now, false, false, config);
    expect(result).toBeCloseTo(2511 + 703, 0);
  });

  it('adds age supplement for 16-17', () => {
    const children = [makeChild('2009-01-01')]; // age 16
    const result = calculateKindgebondenBudget(20000, children, now, false, false, config);
    expect(result).toBeCloseTo(2511 + 936, 0);
  });

  it('adds single parent supplement', () => {
    const children = [makeChild('2020-01-01')];
    const withSupplement = calculateKindgebondenBudget(20000, children, now, true, false, config);
    const withoutSupplement = calculateKindgebondenBudget(20000, children, now, false, false, config);
    expect(withSupplement - withoutSupplement).toBeCloseTo(3389, 0);
  });

  it('reduces by income above threshold', () => {
    const children = [makeChild('2020-01-01')];
    const income = 40000;
    const kgb = config.kindgebondenBudget;
    const threshold = kgb.drempelinkomen; // single
    const reduction = kgb.reductionRate * Math.max(0, income - threshold);
    const expected = Math.max(0, kgb.basePerChild - reduction);
    const result = calculateKindgebondenBudget(income, children, now, false, false, config);
    expect(result).toBeCloseTo(expected, 0);
  });

  it('couple has higher reduction threshold', () => {
    const children = [makeChild('2020-01-01')];
    const income = 35000;
    const single = calculateKindgebondenBudget(income, children, now, false, false, config);
    const couple = calculateKindgebondenBudget(income, children, now, false, true, config);
    // Couple has higher threshold → less reduction → higher KGB
    expect(couple).toBeGreaterThan(single);
  });

  it('returns 0 for child 18+', () => {
    const children = [makeChild('2005-01-01')]; // age 20
    expect(calculateKindgebondenBudget(20000, children, now, false, false, config)).toBe(0);
  });
});

// ================================================================
// Kinderbijslag
// ================================================================
describe('calculateKinderbijslag', () => {
  it('returns 0 with no children', () => {
    expect(calculateKinderbijslag([], now, config)).toBe(0);
  });

  it('returns quarterly0to5 × 4 for child under 6', () => {
    const children = [makeChild('2022-01-01')]; // age 3
    expect(calculateKinderbijslag(children, now, config)).toBeCloseTo(291.49 * 4, 0);
  });

  it('returns quarterly6to11 × 4 for child 6-11', () => {
    const children = [makeChild('2017-01-01')]; // age 8
    expect(calculateKinderbijslag(children, now, config)).toBeCloseTo(353.95 * 4, 0);
  });

  it('returns quarterly12to17 × 4 for child 12-17', () => {
    const children = [makeChild('2012-01-01')]; // age 13
    expect(calculateKinderbijslag(children, now, config)).toBeCloseTo(416.41 * 4, 0);
  });

  it('returns 0 for child 18+', () => {
    const children = [makeChild('2005-01-01')];
    expect(calculateKinderbijslag(children, now, config)).toBe(0);
  });

  it('sums amounts for multiple children', () => {
    const children = [
      makeChild('2022-01-01'), // age 3
      makeChild('2017-01-01'), // age 8
    ];
    const expected = 291.49 * 4 + 353.95 * 4;
    expect(calculateKinderbijslag(children, now, config)).toBeCloseTo(expected, 0);
  });
});

// ================================================================
// Kinderopvangtoeslag
// ================================================================
describe('calculateKinderopvangtoeslag', () => {
  it('combines multiple childcare arrangements for the same child', () => {
    const childcareConfig: ToeslagenConfig = {
      ...config,
      kinderopvangtoeslag: {
        ...config.kinderopvangtoeslag,
        enabled: true,
      },
    };
    const child = makeChild('2022-01-01', {
      childcareArrangements: [
        {
          id: 'arr1',
          type: 'daycare',
          hoursPerMonth: 80,
          hourlyRate: 10.5,
        },
        {
          id: 'arr2',
          type: 'gastouder',
          hoursPerMonth: 24,
          hourlyRate: 8.2,
        },
      ],
    });

    const result = calculateKinderopvangtoeslag(20000, [child], now, childcareConfig);
    const pct = childcareConfig.kinderopvangtoeslag.maxPercentage;
    const expectedAnnualCost = (
      80 * Math.min(10.5, childcareConfig.kinderopvangtoeslag.maxHourlyRateDaycare) +
      24 * Math.min(8.2, childcareConfig.kinderopvangtoeslag.maxHourlyRateGastouder)
    ) * 12;

    expect(result).toBeCloseTo(expectedAnnualCost * pct, 0);
  });
});

// ================================================================
// Huurtoeslag
// ================================================================
describe('calculateHuurtoeslag', () => {
  it('returns 0 when disabled', () => {
    const cfg = { ...config, huurtoeslag: { ...config.huurtoeslag, enabled: false } };
    expect(calculateHuurtoeslag(25000, 0, false, cfg)).toBe(0);
  });

  it('returns 0 when rent is 0', () => {
    const cfg = { ...config, huurtoeslag: { ...config.huurtoeslag, enabled: true, monthlyRent: 0 } };
    expect(calculateHuurtoeslag(25000, 0, false, cfg)).toBe(0);
  });

  it('returns 0 when income exceeds max', () => {
    const cfg = {
      ...config,
      huurtoeslag: { ...config.huurtoeslag, enabled: true, monthlyRent: 600 },
    };
    expect(calculateHuurtoeslag(50000, 0, false, cfg)).toBe(0);
  });

  it('returns positive amount for eligible case', () => {
    const cfg = {
      ...config,
      huurtoeslag: { ...config.huurtoeslag, enabled: true, monthlyRent: 600 },
    };
    const result = calculateHuurtoeslag(25000, 0, false, cfg);
    expect(result).toBeGreaterThan(0);
  });

  it('returns 0 when wealth exceeds limit', () => {
    const cfg = {
      ...config,
      huurtoeslag: { ...config.huurtoeslag, enabled: true, monthlyRent: 600 },
    };
    expect(calculateHuurtoeslag(25000, 50000, false, cfg)).toBe(0);
  });
});

// ================================================================
// calculateAnnualToeslagen — aggregate
// ================================================================
describe('calculateAnnualToeslagen', () => {
  it('returns all zeros when disabled', () => {
    const disabledConfig = { ...config, enabled: false };
    const result = calculateAnnualToeslagen(25000, 0, [], now, false, false, disabledConfig);
    expect(result.total).toBe(0);
    expect(result.zorgtoeslag).toBe(0);
    expect(result.kindgebondenBudget).toBe(0);
    expect(result.kinderbijslag).toBe(0);
    expect(result.kinderopvangtoeslag).toBe(0);
    expect(result.huurtoeslag).toBe(0);
  });

  it('total equals sum of all components', () => {
    const children = [makeChild('2020-01-01')];
    const result = calculateAnnualToeslagen(20000, 0, children, now, false, true, config);
    const sum =
      result.zorgtoeslag +
      result.kindgebondenBudget +
      result.kinderbijslag +
      result.kinderopvangtoeslag +
      result.huurtoeslag;
    expect(result.total).toBeCloseTo(sum, 2);
  });

  it('low income single parent with child gets zorgtoeslag + KGB + kinderbijslag', () => {
    const children = [makeChild('2020-01-01')];
    const result = calculateAnnualToeslagen(20000, 0, children, now, false, true, config);
    expect(result.zorgtoeslag).toBeGreaterThan(0);
    expect(result.kindgebondenBudget).toBeGreaterThan(0);
    expect(result.kinderbijslag).toBeGreaterThan(0);
  });
});
