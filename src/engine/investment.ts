import type { InvestmentAccount } from '@/types';

/**
 * Calculate investment growth for one month
 */
export function calculateMonthlyInvestmentGrowth(
  account: InvestmentAccount,
  currentBalance: number,
  currentMonth?: number, // 0-indexed month of year (for annual compounding)
): { newBalance: number; growth: number; fees: number } {
  const monthlyReturn = account.expectedReturn / 12;
  const monthlyFee = account.expenseRatio / 12;

  // Net return after fees
  const netMonthlyReturn = monthlyReturn - monthlyFee;

  let growth: number;
  let fees: number;

  if (account.compoundingFrequency === 'monthly') {
    growth = currentBalance * netMonthlyReturn;
    fees = currentBalance * monthlyFee;
  } else {
    // Annual compounding: growth only credited in December (month 11)
    const isCompoundingMonth = (currentMonth ?? 11) === 11;
    if (isCompoundingMonth) {
      const annualReturn = account.expectedReturn - account.expenseRatio;
      growth = currentBalance * annualReturn;
      fees = currentBalance * account.expenseRatio;
    } else {
      growth = 0;
      fees = 0;
    }
  }

  const newBalance = currentBalance + account.monthlyContribution + growth;

  return { newBalance, growth, fees };
}

/**
 * Calculate total investment portfolio value for one month
 */
export function calculatePortfolioMonth(
  accounts: InvestmentAccount[],
  balances: Map<string, number>,
  currentMonth?: number,
): {
  totalValue: number;
  totalGrowth: number;
  totalContributions: number;
  cashGrowth: number;
  investmentGrowth: number;
  cashContributions: number;
  investmentContributions: number;
  newBalances: Map<string, number>;
} {
  const newBalances = new Map<string, number>();
  let totalGrowth = 0;
  let totalContributions = 0;
  let cashGrowth = 0;
  let investmentGrowth = 0;
  let cashContributions = 0;
  let investmentContributions = 0;

  for (const account of accounts) {
    const currentBalance = balances.get(account.id) ?? account.balance;
    const { newBalance, growth } = calculateMonthlyInvestmentGrowth(account, currentBalance, currentMonth);
    newBalances.set(account.id, newBalance);
    totalGrowth += growth;
    totalContributions += account.monthlyContribution;
    if (account.type === 'savings') {
      cashGrowth += growth;
      cashContributions += account.monthlyContribution;
    } else {
      investmentGrowth += growth;
      investmentContributions += account.monthlyContribution;
    }
  }

  let totalValue = 0;
  for (const balance of newBalances.values()) {
    totalValue += balance;
  }

  return {
    totalValue,
    totalGrowth,
    totalContributions,
    cashGrowth,
    investmentGrowth,
    cashContributions,
    investmentContributions,
    newBalances,
  };
}

/**
 * Calculate FIRE number
 */
export function calculateFireNumber(annualSpending: number, swr: number): number {
  if (swr <= 0) return Infinity;
  return annualSpending / swr;
}

/**
 * Calculate Coast FIRE amount:
 * How much do you need today so that compound growth alone reaches FIRE number by target age?
 */
export function calculateCoastFire(
  fireNumber: number,
  yearsUntilRetirement: number,
  expectedReturn: number,
): number {
  if (yearsUntilRetirement <= 0 || expectedReturn <= 0) return fireNumber;
  return fireNumber / Math.pow(1 + expectedReturn, yearsUntilRetirement);
}
