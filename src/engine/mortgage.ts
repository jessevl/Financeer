import type { MortgageConfig } from '@/types';

export interface MortgagePayment {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  remainingBalance: number;
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
    const remainingMonths = totalMonths - month + 1;

    // Determine interest rate (fixed vs variable)
    const startDate = new Date(config.startDate);
    const currentMonth = new Date(startDate);
    currentMonth.setMonth(currentMonth.getMonth() + month - 1);
    const yearsElapsed = (currentMonth.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const rate = yearsElapsed < config.fixedRatePeriod ? config.interestRate : config.variableRateAfter;

    const { payment, interest, principal } = calculateMonthlyMortgagePayment(
      config.type,
      balance,
      rate,
      remainingMonths,
    );

    // Check for extra repayments this month
    const extraForMonth = config.extraRepayments
      .filter((r) => {
        const repayDate = new Date(r.date);
        return (
          repayDate.getFullYear() === currentMonth.getFullYear() &&
          repayDate.getMonth() === currentMonth.getMonth()
        );
      })
      .reduce((sum, r) => sum + r.amount, 0);

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
