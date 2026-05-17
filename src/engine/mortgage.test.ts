import { describe, expect, it } from 'vitest';

import { generateAmortisationSchedule, getMortgageSnapshotAtDate } from './mortgage';
import type { MortgageConfig } from '@/types';

function makeMortgage(overrides: Partial<MortgageConfig> = {}): MortgageConfig {
  return {
    id: 'mtg-1',
    label: 'Mortgage',
    type: 'annuity',
    principal: 280000,
    interestRate: 0.04,
    fixedRatePeriod: 5,
    variableRateAfter: 0.052,
    termYears: 30,
    startDate: '2020-01-01',
    deductibilityStartDate: '2020-01-01',
    extraRepayments: [],
    nhg: false,
    ...overrides,
  };
}

describe('getMortgageSnapshotAtDate', () => {
  it('shows the current balance and post-fixed rate after the fixed period lapses', () => {
    const snapshot = getMortgageSnapshotAtDate(makeMortgage(), new Date('2026-01-01'));

    expect(snapshot.balance).toBeLessThan(280000);
    expect(snapshot.currentRate).toBeCloseTo(0.052, 6);
    expect(snapshot.remainingMonths).toBe(288);
    expect(snapshot.currentInterest).toBeCloseTo(snapshot.balance * snapshot.currentRate / 12, 2);
    expect(snapshot.currentPayment).toBeGreaterThan(snapshot.currentInterest);
  });

  it('keeps the original opening state before the mortgage starts', () => {
    const snapshot = getMortgageSnapshotAtDate(makeMortgage(), new Date('2019-12-01'));

    expect(snapshot.hasStarted).toBe(false);
    expect(snapshot.balance).toBe(280000);
    expect(snapshot.currentRate).toBeCloseTo(0.04, 6);
    expect(snapshot.remainingMonths).toBe(360);
  });
});

describe('generateAmortisationSchedule', () => {
  it('applies the NHG discount to the amortisation schedule rate', () => {
    const schedule = generateAmortisationSchedule(makeMortgage({ nhg: true, variableRateAfter: 0.04 }));

    expect(schedule[0].interest).toBeCloseTo(280000 * 0.034 / 12, 2);
  });
});