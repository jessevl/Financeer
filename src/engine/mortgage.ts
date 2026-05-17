import type { MortgageConfig } from '@/types';

const NHG_RATE_DISCOUNT = 0.006;

export interface MortgagePayment {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  remainingBalance: number;
}

export interface MortgageSnapshot {
  hasStarted: boolean;
  isPaidOff: boolean;
  elapsedMonths: number;
  remainingMonths: number;
  fixedRateMonthsRemaining: number;
  balance: number;
  currentRate: number;
  currentPayment: number;
  currentInterest: number;
  currentPrincipal: number;
  totalInterestRemaining: number;
  totalCostRemaining: number;
}

function getMortgageElapsedMonths(config: MortgageConfig, asOfDate: Date): number {
  const startDate = new Date(config.startDate);
  return (asOfDate.getFullYear() - startDate.getFullYear()) * 12 +
    (asOfDate.getMonth() - startDate.getMonth());
}

function getMortgageMonthDate(config: MortgageConfig, elapsedMonths: number): Date {
  const currentMonth = new Date(config.startDate);
  currentMonth.setMonth(currentMonth.getMonth() + elapsedMonths);
  return currentMonth;
}

function getExtraRepaymentForMonth(config: MortgageConfig, monthDate: Date): number {
  return config.extraRepayments
    .filter((repayment) => {
      const repaymentDate = new Date(repayment.date);
      return (
        repaymentDate.getFullYear() === monthDate.getFullYear() &&
        repaymentDate.getMonth() === monthDate.getMonth()
      );
    })
    .reduce((sum, repayment) => sum + repayment.amount, 0);
}

export function getEffectiveMortgageRate(config: MortgageConfig, elapsedMonths: number): number {
  const yearsElapsed = elapsedMonths / 12;
  const baseRate = yearsElapsed < config.fixedRatePeriod
    ? config.interestRate
    : config.variableRateAfter || config.interestRate;
  return config.nhg ? Math.max(0, baseRate - NHG_RATE_DISCOUNT) : baseRate;
}

export function getMortgageSnapshotAtDate(config: MortgageConfig, asOfDate = new Date()): MortgageSnapshot {
  const totalMonths = config.termYears * 12;
  const rawElapsedMonths = getMortgageElapsedMonths(config, asOfDate);
  const completedMonths = Math.min(Math.max(rawElapsedMonths, 0), totalMonths);
  const hasStarted = rawElapsedMonths >= 0;

  let balance = config.principal;

  for (let elapsedMonth = 0; elapsedMonth < completedMonths && balance > 0.01; elapsedMonth++) {
    const remainingMonths = totalMonths - elapsedMonth;
    const rate = getEffectiveMortgageRate(config, elapsedMonth);
    const { principal } = calculateMonthlyMortgagePayment(
      config.type,
      balance,
      rate,
      remainingMonths,
    );
    const currentMonth = getMortgageMonthDate(config, elapsedMonth);
    const extraRepayment = getExtraRepaymentForMonth(config, currentMonth);
    const actualPrincipal = Math.min(principal + extraRepayment, balance);
    balance = Math.max(0, balance - actualPrincipal);
  }

  const remainingMonths = Math.max(0, totalMonths - completedMonths);
  const fixedRateMonthsRemaining = Math.max(0, config.fixedRatePeriod * 12 - completedMonths);

  if (!hasStarted || (balance > 0.01 && remainingMonths > 0)) {
    const currentRate = getEffectiveMortgageRate(config, completedMonths);
    const currentPayment = remainingMonths > 0
      ? calculateMonthlyMortgagePayment(config.type, balance, currentRate, remainingMonths)
      : { payment: 0, interest: 0, principal: 0 };

    let projectedBalance = balance;
    let totalInterestRemaining = 0;
    let totalCostRemaining = 0;

    for (let elapsedMonth = completedMonths; elapsedMonth < totalMonths && projectedBalance > 0.01; elapsedMonth++) {
      const remainingProjectionMonths = totalMonths - elapsedMonth;
      const projectionRate = getEffectiveMortgageRate(config, elapsedMonth);
      const { payment, interest, principal } = calculateMonthlyMortgagePayment(
        config.type,
        projectedBalance,
        projectionRate,
        remainingProjectionMonths,
      );
      const projectionMonth = getMortgageMonthDate(config, elapsedMonth);
      const extraRepayment = getExtraRepaymentForMonth(config, projectionMonth);
      const actualPrincipal = Math.min(principal + extraRepayment, projectedBalance);

      totalInterestRemaining += interest;
      totalCostRemaining += payment + extraRepayment;
      projectedBalance = Math.max(0, projectedBalance - actualPrincipal);
    }

    return {
      hasStarted,
      isPaidOff: remainingMonths === 0 || balance <= 0.01,
      elapsedMonths: completedMonths,
      remainingMonths,
      fixedRateMonthsRemaining,
      balance,
      currentRate,
      currentPayment: currentPayment.payment,
      currentInterest: currentPayment.interest,
      currentPrincipal: currentPayment.principal,
      totalInterestRemaining,
      totalCostRemaining,
    };
  }

  return {
    hasStarted,
    isPaidOff: true,
    elapsedMonths: completedMonths,
    remainingMonths: 0,
    fixedRateMonthsRemaining: 0,
    balance: 0,
    currentRate: 0,
    currentPayment: 0,
    currentInterest: 0,
    currentPrincipal: 0,
    totalInterestRemaining: 0,
    totalCostRemaining: 0,
  };
}

/**
 * Calculate a single month's mortgage payment
 */
export function calculateMonthlyMortgagePayment(
  type: 'annuity' | 'linear' | 'interest-only',
  remainingPrincipal: number,
  annualRate: number,
  remainingMonths: number,
): { payment: number; interest: number; principal: number } {
  if (remainingPrincipal <= 0 || remainingMonths <= 0) {
    return { payment: 0, interest: 0, principal: 0 };
  }

  const monthlyRate = annualRate / 12;
  const interest = remainingPrincipal * monthlyRate;

  if (type === 'interest-only') {
    return { payment: interest, interest, principal: 0 };
  }

  if (type === 'linear') {
    const principalPayment = remainingPrincipal / remainingMonths;
    return {
      payment: principalPayment + interest,
      interest,
      principal: principalPayment,
    };
  }

  // Annuity
  if (monthlyRate === 0) {
    const principalPayment = remainingPrincipal / remainingMonths;
    return { payment: principalPayment, interest: 0, principal: principalPayment };
  }

  const annuity =
    remainingPrincipal *
    (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
    (Math.pow(1 + monthlyRate, remainingMonths) - 1);

  const principalPayment = annuity - interest;

  return {
    payment: annuity,
    interest,
    principal: principalPayment,
  };
}

/**
 * Generate full amortisation schedule
 */
export function generateAmortisationSchedule(config: MortgageConfig): MortgagePayment[] {
  const schedule: MortgagePayment[] = [];
  let balance = config.principal;
  const totalMonths = config.termYears * 12;

  for (let month = 1; month <= totalMonths && balance > 0.01; month++) {
    const elapsedMonths = month - 1;
    const remainingMonths = totalMonths - elapsedMonths;
    const currentMonth = getMortgageMonthDate(config, elapsedMonths);
    const rate = getEffectiveMortgageRate(config, elapsedMonths);

    const { payment, interest, principal } = calculateMonthlyMortgagePayment(
      config.type,
      balance,
      rate,
      remainingMonths,
    );

    const extraForMonth = getExtraRepaymentForMonth(config, currentMonth);

    const totalPrincipal = Math.min(principal + extraForMonth, balance);
    balance = Math.max(0, balance - totalPrincipal);

    schedule.push({
      month,
      payment: payment + extraForMonth,
      interest,
      principal: totalPrincipal,
      remainingBalance: balance,
    });
  }

  return schedule;
}
