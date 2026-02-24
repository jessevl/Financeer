import { describe, it, expect } from 'vitest';
import {
  calculateBox1Tax,
  calculateBox2Tax,
  calculateGeneralTaxCredit,
  calculateLabourTaxCredit,
  calculateIACK,
  calculateOuderenkorting,
  calculateBox3Tax,
  calculateEigenwoningforfait,
  calculateAnnualNetIncome,
  calculateZVW,
  calculateJaarruimte,
  calculateHillenRelief,
  calculateGiftenaftrek,
} from './tax';
import { taxPreset2025 } from '@/data/taxPresets';
import type { TaxConfig } from '@/types';

// Build a full TaxConfig from preset for testing
const tax2025: TaxConfig = {
  filingType: 'single',
  presetYear: 2025,
  ...taxPreset2025,
};

const coupleTax: TaxConfig = { ...tax2025, filingType: 'couple' };

// ================================================================
// Box 1 progressive tax brackets
// ================================================================
describe('calculateBox1Tax', () => {
  const brackets = tax2025.box1Brackets;

  it('returns 0 for zero income', () => {
    expect(calculateBox1Tax(0, brackets)).toBe(0);
  });

  it('taxes first bracket at 36.97%', () => {
    const tax = calculateBox1Tax(30000, brackets);
    expect(tax).toBeCloseTo(30000 * 0.3697, 0);
  });

  it('applies second bracket correctly for income between brackets', () => {
    const income = 50000;
    const expected = 38441 * 0.3697 + (income - 38441) * 0.3697;
    expect(calculateBox1Tax(income, brackets)).toBeCloseTo(expected, 0);
  });

  it('applies top bracket at 49.5% for high income', () => {
    const income = 100000;
    const expected = 76817 * 0.3697 + (income - 76817) * 0.495;
    expect(calculateBox1Tax(income, brackets)).toBeCloseTo(expected, 0);
  });

  it('handles negative income gracefully', () => {
    expect(calculateBox1Tax(-5000, tax2025.box1Brackets)).toBe(0);
  });
});

// ================================================================
// Box 2 tax (substantial interest)
// ================================================================
describe('calculateBox2Tax', () => {
  it('returns 0 for zero income', () => {
    expect(calculateBox2Tax(0, tax2025.box2)).toBe(0);
  });

  it('applies lower rate for income within bracket', () => {
    expect(calculateBox2Tax(50000, tax2025.box2)).toBeCloseTo(50000 * 0.245, 2);
  });

  it('applies two-bracket system for income exceeding limit', () => {
    const income = 100000;
    const expected = 67000 * 0.245 + 33000 * 0.33;
    expect(calculateBox2Tax(income, tax2025.box2)).toBeCloseTo(expected, 2);
  });

  it('doubles bracket for couple filing', () => {
    const income = 100000;
    // Couple limit: 67000 * 2 = 134000 → all at lower rate
    const expected = 100000 * 0.245;
    expect(calculateBox2Tax(income, tax2025.box2, true)).toBeCloseTo(expected, 2);
  });
});

// ================================================================
// General tax credit (algemene heffingskorting)
// ================================================================
describe('calculateGeneralTaxCredit', () => {
  it('returns max amount for low income', () => {
    expect(calculateGeneralTaxCredit(20000, tax2025)).toBe(3362);
  });

  it('returns max amount at phase-out start', () => {
    expect(calculateGeneralTaxCredit(24813, tax2025)).toBe(3362);
  });

  it('returns 0 at phase-out end', () => {
    expect(calculateGeneralTaxCredit(75518, tax2025)).toBe(0);
  });

  it('returns 0 above phase-out end', () => {
    expect(calculateGeneralTaxCredit(100000, tax2025)).toBe(0);
  });

  it('phases out linearly', () => {
    const midpoint = (24813 + 75518) / 2;
    const credit = calculateGeneralTaxCredit(midpoint, tax2025);
    expect(credit).toBeCloseTo(3362 / 2, 0);
  });
});

// ================================================================
// Labour tax credit (arbeidskorting) — multi-segment build-up
// ================================================================
describe('calculateLabourTaxCredit', () => {
  it('returns 0 below build-up start (€11,491)', () => {
    expect(calculateLabourTaxCredit(10000, tax2025)).toBe(0);
  });

  it('returns 0 at exactly build-up start', () => {
    expect(calculateLabourTaxCredit(11491, tax2025)).toBe(0);
  });

  it('builds up in first segment (8.231%) for income €20,000', () => {
    const expected = 0.08231 * (20000 - 11491);
    const result = calculateLabourTaxCredit(20000, tax2025);
    expect(result).toBeCloseTo(expected, 0);
  });

  it('transitions to second segment at €24,821', () => {
    // At exactly 24821, still in first segment
    const atBoundary = 0.08231 * (24821 - 11491);
    expect(calculateLabourTaxCredit(24821, tax2025)).toBeCloseTo(atBoundary, 0);
  });

  it('builds up in second segment (29.861%) for income €30,000', () => {
    const expected = 1098 + 0.29861 * (30000 - 24821);
    const result = calculateLabourTaxCredit(30000, tax2025);
    expect(result).toBeCloseTo(expected, 0);
  });

  it('reaches max amount at build-up end (€39,958)', () => {
    const result = calculateLabourTaxCredit(39958, tax2025);
    // At buildUpEnd the segment formula exceeds maxAmount → capped at 5599
    expect(result).toBe(5599);
  });

  it('returns max at plateau (capped at maxAmount)', () => {
    // At buildUpEnd the segment formula would give ~5618 but is capped at maxAmount
    expect(calculateLabourTaxCredit(39958, tax2025)).toBe(5599);
  });

  it('phases out linearly to minAmount', () => {
    const income = 80000;
    const phaseOutRange = 124935 - 39958;
    const excess = income - 39958;
    const expected = 5599 - (excess / phaseOutRange) * (5599 - 69);
    expect(calculateLabourTaxCredit(income, tax2025)).toBeCloseTo(expected, 0);
  });

  it('returns minAmount (€69) above phase-out end', () => {
    expect(calculateLabourTaxCredit(130000, tax2025)).toBe(69);
  });

  it('returns minAmount (€69) at exactly phase-out end', () => {
    expect(calculateLabourTaxCredit(124935, tax2025)).toBe(69);
  });
});

// ================================================================
// IACK
// ================================================================
describe('calculateIACK', () => {
  it('returns 0 without child under 12', () => {
    expect(calculateIACK(60000, tax2025, false)).toBe(0);
  });

  it('returns 0 below income threshold', () => {
    expect(calculateIACK(5000, tax2025, true)).toBe(0);
  });

  it('builds up at 11.45% above threshold', () => {
    const income = 20000;
    const expected = (income - 5876) * 0.1145;
    expect(calculateIACK(income, tax2025, true)).toBeCloseTo(expected, 0);
  });

  it('caps at maxAmount', () => {
    expect(calculateIACK(200000, tax2025, true)).toBe(2694);
  });
});

// ================================================================
// Ouderenkorting
// ================================================================
describe('calculateOuderenkorting', () => {
  it('returns 0 when not AOW age', () => {
    expect(calculateOuderenkorting(30000, tax2025, false, true)).toBe(0);
  });

  it('returns max + alleenstaand for single AOW with low income', () => {
    const result = calculateOuderenkorting(30000, tax2025, true, true);
    expect(result).toBe(1955 + 524);
  });

  it('returns max without alleenstaand for partnered AOW', () => {
    const result = calculateOuderenkorting(30000, tax2025, true, false);
    expect(result).toBe(1955);
  });

  it('phases out at 15% above threshold', () => {
    const income = 50000;
    const reduction = (income - 44770) * 0.15;
    const expected = Math.max(0, 1955 - reduction);
    expect(calculateOuderenkorting(income, tax2025, true, false)).toBeCloseTo(expected, 0);
  });
});

// ================================================================
// ZVW
// ================================================================
describe('calculateZVW', () => {
  it('calculates ZVW on income up to max', () => {
    expect(calculateZVW(50000, tax2025)).toBeCloseTo(50000 * 0.0565, 2);
  });

  it('caps at max income', () => {
    expect(calculateZVW(100000, tax2025)).toBeCloseTo(71628 * 0.0565, 2);
  });
});

// ================================================================
// Box 3 wealth tax
// ================================================================
describe('calculateBox3Tax', () => {
  it('returns 0 below free threshold (single)', () => {
    expect(calculateBox3Tax(50000, 0, 0, tax2025, false)).toBe(0);
  });

  it('returns 0 below free threshold (couple)', () => {
    // Couple threshold = 57000 * 2 = 114000
    expect(calculateBox3Tax(100000, 0, 0, tax2025, true)).toBe(0);
  });

  it('taxes savings above threshold at savings fictional return rate', () => {
    const savings = 100000; // 100k savings, single
    // grondslag = 100k, free threshold = 57k, taxable = 43k
    // Fictional return: savings rate 0.36% → 100000 * 0.0036 = 360
    // Proportional taxable: (360 / 100000) * 43000 = 154.8
    // Tax: 154.8 * 0.36 = 55.7
    const result = calculateBox3Tax(savings, 0, 0, tax2025, false);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(100000 * 0.0036 / 100000 * 43000 * 0.36, 0);
  });

  it('taxes investments at higher fictional return rate', () => {
    const result = calculateBox3Tax(0, 100000, 0, tax2025, false);
    // Investment rate is 6.04% → much higher tax than savings
    const savingsResult = calculateBox3Tax(100000, 0, 0, tax2025, false);
    expect(result).toBeGreaterThan(savingsResult);
  });

  it('deducts debts above threshold', () => {
    // Single debt threshold: 3700
    const withDebt = calculateBox3Tax(0, 100000, 10000, tax2025, false);
    const withoutDebt = calculateBox3Tax(0, 100000, 0, tax2025, false);
    expect(withDebt).toBeLessThan(withoutDebt);
  });

  it('ignores debts below threshold', () => {
    const withSmallDebt = calculateBox3Tax(0, 100000, 3000, tax2025, false);
    const withoutDebt = calculateBox3Tax(0, 100000, 0, tax2025, false);
    expect(withSmallDebt).toBe(withoutDebt);
  });
});

// ================================================================
// Eigenwoningforfait
// ================================================================
describe('calculateEigenwoningforfait', () => {
  it('returns 0 for WOZ value of 0', () => {
    expect(calculateEigenwoningforfait(0, tax2025)).toBe(0);
  });

  it('applies standard rate below threshold', () => {
    const woz = 400000;
    expect(calculateEigenwoningforfait(woz, tax2025)).toBeCloseTo(woz * 0.0035, 0);
  });

  it('applies excess rate (2.35%) above threshold', () => {
    const woz = 1500000;
    const expected = 1310000 * 0.0035 + (woz - 1310000) * 0.0235;
    expect(calculateEigenwoningforfait(woz, tax2025)).toBeCloseTo(expected, 0);
  });
});

// ================================================================
// Jaarruimte
// ================================================================
describe('calculateJaarruimte', () => {
  it('returns 0 for income below threshold', () => {
    expect(calculateJaarruimte(15000, tax2025)).toBe(0);
  });

  it('calculates correctly for typical income', () => {
    const gross = 60000;
    const opt = tax2025.taxOptimizations;
    const expected = Math.min(opt.jaarruimteMax, (Math.min(gross, opt.jaarruimteMaxIncome) - opt.jaarruimteThreshold) * opt.jaarruimtePercent - opt.factorA);
    expect(calculateJaarruimte(gross, tax2025)).toBeCloseTo(Math.max(0, expected), 0);
  });

  it('caps at jaarruimteMax', () => {
    expect(calculateJaarruimte(500000, tax2025)).toBeLessThanOrEqual(tax2025.taxOptimizations.jaarruimteMax);
  });
});

// ================================================================
// Hillen relief
// ================================================================
describe('calculateHillenRelief', () => {
  it('returns 0 when mortgage interest exceeds EWF', () => {
    expect(calculateHillenRelief(1000, 2000, 2025, tax2025)).toBe(0);
  });

  it('applies partial relief (phase-out) for 2025', () => {
    const ewf = 5000;
    const interest = 2000;
    const relief = calculateHillenRelief(ewf, interest, 2025, tax2025);
    // 2025 is 6 years after 2019 → remaining factor = 1 - 6/30 = 0.8
    const expectedExcess = ewf - interest; // 3000
    const expectedRelief = expectedExcess * 0.8;
    expect(relief).toBeCloseTo(expectedRelief, 0);
  });

  it('returns 0 when fully phased out (2049)', () => {
    expect(calculateHillenRelief(5000, 2000, 2049, tax2025)).toBe(0);
  });
});

// ================================================================
// Giftenaftrek
// ================================================================
describe('calculateGiftenaftrek', () => {
  it('returns 0 when no gifts configured', () => {
    expect(calculateGiftenaftrek(60000, tax2025)).toBe(0);
  });

  it('deducts periodieke giften fully', () => {
    const config = {
      ...tax2025,
      taxOptimizations: { ...tax2025.taxOptimizations, giftenPeriodiek: 2000 },
    };
    expect(calculateGiftenaftrek(60000, config)).toBe(2000);
  });

  it('applies threshold and cap for regular gifts', () => {
    const config = {
      ...tax2025,
      taxOptimizations: { ...tax2025.taxOptimizations, giftenRegular: 5000 },
    };
    const income = 60000;
    const threshold = income * 0.01; // 600
    const maxDeductible = income * 0.10; // 6000
    const expected = Math.min(maxDeductible, Math.max(0, 5000 - threshold));
    expect(calculateGiftenaftrek(income, config)).toBeCloseTo(expected, 0);
  });
});

// ================================================================
// Full annual net income — single filer
// ================================================================
describe('calculateAnnualNetIncome — single', () => {
  it('calculates net income for typical single earner', () => {
    const result = calculateAnnualNetIncome(60000, 0, 0, tax2025, {
      isSingle: true,
      currentYear: 2025,
    });

    expect(result.netIncome).toBeGreaterThan(0);
    expect(result.netIncome).toBeLessThan(60000);
    expect(result.incomeTax).toBeGreaterThan(0);
    expect(result.generalCredit).toBeGreaterThan(0);
    expect(result.labourCredit).toBeGreaterThan(0);
    expect(result.zvw).toBeCloseTo(Math.min(60000, 71628) * 0.0565, 0);
    expect(result.effectiveRate).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeLessThan(1);
  });

  it('includes mortgage interest deduction', () => {
    const withMortgage = calculateAnnualNetIncome(60000, 8000, 1400, tax2025, {
      isSingle: true,
      currentYear: 2025,
    });
    const withoutMortgage = calculateAnnualNetIncome(60000, 0, 0, tax2025, {
      isSingle: true,
      currentYear: 2025,
    });

    // Mortgage interest > EWF → net deduction → higher net income
    expect(withMortgage.netIncome).toBeGreaterThan(withoutMortgage.netIncome);
  });

  it('handles zero income', () => {
    const result = calculateAnnualNetIncome(0, 0, 0, tax2025, { isSingle: true });
    expect(result.netIncome).toBe(0);
    expect(result.incomeTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });
});

// ================================================================
// Full annual net income — couple (EACH starts at bracket 1)
// ================================================================
describe('calculateAnnualNetIncome — couple per-person', () => {
  it('each partner gets their own bracket 1 start', () => {
    const primaryGross = 60000;
    const partnerGross = 40000;

    const primaryTax = calculateAnnualNetIncome(primaryGross, 0, 0, coupleTax, {
      isSingle: false,
      currentYear: 2025,
    });
    const partnerTax = calculateAnnualNetIncome(partnerGross, 0, 0, coupleTax, {
      isSingle: false,
      currentYear: 2025,
    });

    // Combined net should be MORE than taxing combined income as single person
    const combinedAsCouple = primaryTax.netIncome + partnerTax.netIncome;

    const singleTax = calculateAnnualNetIncome(primaryGross + partnerGross, 0, 0, tax2025, {
      isSingle: true,
      currentYear: 2025,
    });

    // Each partner has their own brackets → more tax-efficient than pooled
    expect(combinedAsCouple).toBeGreaterThan(singleTax.netIncome);
  });

  it('partner gets their own general tax credit', () => {
    const partnerTax = calculateAnnualNetIncome(25000, 0, 0, coupleTax, {
      isSingle: false,
      currentYear: 2025,
    });
    expect(partnerTax.generalCredit).toBeGreaterThan(0);
    // 25k is slightly above phaseOutStart (24813), so credit is just below max
    expect(partnerTax.generalCredit).toBeCloseTo(3362, -2);
  });

  it('partner gets their own arbeidskorting', () => {
    const partnerTax = calculateAnnualNetIncome(35000, 0, 0, coupleTax, {
      isSingle: false,
      currentYear: 2025,
    });
    expect(partnerTax.labourCredit).toBeGreaterThan(0);
  });

  it('IACK applies when child under 12 present', () => {
    const result = calculateAnnualNetIncome(40000, 0, 0, coupleTax, {
      isSingle: false,
      hasChildUnder12: true,
      currentYear: 2025,
    });
    expect(result.iackCredit).toBeGreaterThan(0);
  });
});

// ================================================================
// Self-employment deductions
// ================================================================
describe('calculateAnnualNetIncome — self-employment', () => {
  it('applies zelfstandigenaftrek', () => {
    const withSE = calculateAnnualNetIncome(60000, 0, 0, tax2025, {
      hasSelfEmployment: true,
      isSingle: true,
      currentYear: 2025,
    });
    const withoutSE = calculateAnnualNetIncome(60000, 0, 0, tax2025, {
      hasSelfEmployment: false,
      isSingle: true,
      currentYear: 2025,
    });
    expect(withSE.selfEmploymentDeduction).toBeGreaterThan(0);
    expect(withSE.netIncome).toBeGreaterThan(withoutSE.netIncome);
  });
});
