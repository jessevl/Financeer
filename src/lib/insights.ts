// ============================================================
// Dashboard Insight Engine
// Analyses simulation results and detects anomalies,
// notable patterns, and "what changed" callouts.
// ============================================================

import type { SimulationResult, AnnualSummary, Scenario } from '@/types';

export type InsightSeverity = 'positive' | 'warning' | 'info' | 'negative';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  headline: string;
  detail: string;
  /** Which metric area this relates to */
  category: 'fire' | 'income' | 'tax' | 'savings' | 'housing' | 'investment' | 'general';
  /** Numeric value for sorting by importance (higher = more important) */
  importance: number;
}

/**
 * Generate a list of insights from a simulation + scenario.
 * Returns max ~8 most important insights, sorted by importance.
 */
export function generateInsights(sim: SimulationResult, scenario: Scenario): Insight[] {
  const insights: Insight[] = [];
  const summaries = sim.annualSummaries;
  if (summaries.length < 2) return insights;

  const year0 = summaries[0];

  // ---- FIRE Insights ----
  if (sim.fireAge && sim.fireAge < scenario.retirement.targetAge) {
    const yearsEarly = scenario.retirement.targetAge - Math.floor(sim.fireAge);
    insights.push({
      id: 'fire-early',
      severity: 'positive',
      headline: `FIRE ${yearsEarly} year${yearsEarly !== 1 ? 's' : ''} before retirement age`,
      detail: `You could reach financial independence at age ${Math.floor(sim.fireAge)}, ${yearsEarly} years before your target retirement age of ${scenario.retirement.targetAge}.`,
      category: 'fire',
      importance: 90,
    });
  } else if (sim.fireAge && sim.fireAge > scenario.retirement.targetAge) {
    const yearsLate = Math.floor(sim.fireAge) - scenario.retirement.targetAge;
    insights.push({
      id: 'fire-late',
      severity: 'warning',
      headline: `FIRE ${yearsLate} year${yearsLate !== 1 ? 's' : ''} after retirement age`,
      detail: `At current rates, FIRE wealth won't cover expenses until age ${Math.floor(sim.fireAge)}. Consider increasing savings or lowering target expenses.`,
      category: 'fire',
      importance: 95,
    });
  } else if (!sim.fireAge) {
    insights.push({
      id: 'fire-unreachable',
      severity: 'negative',
      headline: 'FIRE target not reached in projection',
      detail: `The simulation does not reach your FIRE number of ${formatCompact(sim.fireNumber)} within the projection period. Consider adjusting your savings rate or target spending.`,
      category: 'fire',
      importance: 100,
    });
  }

  // FIRE progress checkpoint
  const fireProgress = sim.fireNumber > 0 ? sim.currentLiquidNetWorth / sim.fireNumber : 0;
  if (fireProgress >= 0.75 && fireProgress < 1) {
    insights.push({
      id: 'fire-75',
      severity: 'positive',
      headline: `${(fireProgress * 100).toFixed(0)}% of the way to FIRE`,
      detail: `Your current liquid net worth is ${formatCompact(sim.currentLiquidNetWorth)} out of your ${formatCompact(sim.fireNumber)} FIRE target. You're in the home stretch!`,
      category: 'fire',
      importance: 70,
    });
  } else if (fireProgress >= 0.5 && fireProgress < 0.75) {
    insights.push({
      id: 'fire-50',
      severity: 'info',
      headline: `Halfway to FIRE — ${(fireProgress * 100).toFixed(0)}% reached`,
      detail: `Past the halfway point. Compound growth will increasingly accelerate from here.`,
      category: 'fire',
      importance: 55,
    });
  }

  // ---- Savings Rate ----
  if (sim.savingsRate > 0.5) {
    insights.push({
      id: 'savings-high',
      severity: 'positive',
      headline: `${(sim.savingsRate * 100).toFixed(0)}% savings rate — exceptional`,
      detail: `You're saving more than half your income. This is a powerful accelerant for reaching FIRE.`,
      category: 'savings',
      importance: 60,
    });
  } else if (sim.savingsRate > 0 && sim.savingsRate < 0.1) {
    insights.push({
      id: 'savings-low',
      severity: 'warning',
      headline: `Savings rate only ${(sim.savingsRate * 100).toFixed(1)}%`,
      detail: `A low savings rate extends the time to FIRE significantly. Even a small increase can shave years off your timeline.`,
      category: 'savings',
      importance: 75,
    });
  } else if (sim.savingsRate <= 0) {
    insights.push({
      id: 'savings-negative',
      severity: 'negative',
      headline: 'Spending exceeds income',
      detail: `Current expenses and mortgage payments exceed net income. You are drawing down savings each month.`,
      category: 'savings',
      importance: 85,
    });
  }

  // ---- Tax Insights ----
  const effectiveRate = year0.effectiveTaxRate;
  if (effectiveRate > 0.45) {
    insights.push({
      id: 'tax-high',
      severity: 'warning',
      headline: `${(effectiveRate * 100).toFixed(1)}% effective tax rate`,
      detail: `Your combined effective tax rate is high. Check the Tax module for deduction opportunities (lijfrente, giften, mortgage interest).`,
      category: 'tax',
      importance: 50,
    });
  }

  // Tax rate changes over time
  if (summaries.length > 5) {
    const year5 = summaries[4];
    const taxDelta = year5.effectiveTaxRate - year0.effectiveTaxRate;
    if (Math.abs(taxDelta) > 0.03) {
      insights.push({
        id: 'tax-trend',
        severity: taxDelta > 0 ? 'warning' : 'positive',
        headline: `Tax rate ${taxDelta > 0 ? 'rises' : 'drops'} ${Math.abs(taxDelta * 100).toFixed(1)}pp in 5 years`,
        detail: taxDelta > 0
          ? `Your effective tax rate increases from ${(year0.effectiveTaxRate * 100).toFixed(1)}% to ${(year5.effectiveTaxRate * 100).toFixed(1)}% by ${year5.year}, likely due to salary growth pushing into higher brackets.`
          : `Your effective tax rate decreases from ${(year0.effectiveTaxRate * 100).toFixed(1)}% to ${(year5.effectiveTaxRate * 100).toFixed(1)}% by ${year5.year}, likely from tax optimisations or changing income mix.`,
        category: 'tax',
        importance: 40,
      });
    }
  }

  // ---- Income Insights ----
  // Detect year where income drops (retirement transition)
  const incomeDropYear = findSignificantDrop(summaries, s => s.netIncome, 0.2);
  if (incomeDropYear) {
    const dropPct = ((incomeDropYear.prev - incomeDropYear.current) / incomeDropYear.prev * 100).toFixed(0);
    insights.push({
      id: 'income-drop',
      severity: 'info',
      headline: `Net income drops ${dropPct}% at age ${incomeDropYear.summary.age}`,
      detail: `In ${incomeDropYear.summary.year}, net income falls from ${formatCompact(incomeDropYear.prev)} to ${formatCompact(incomeDropYear.current)}. This likely marks the transition to retirement or a life event.`,
      category: 'income',
      importance: 65,
    });
  }

  // ---- Housing Insights ----
  // Mortgage payoff
  const mortgagePayoffYear = summaries.find((s, i) =>
    i > 0 && s.endMortgageBalance === 0 && summaries[i - 1].endMortgageBalance > 0
  );
  if (mortgagePayoffYear) {
    insights.push({
      id: 'mortgage-payoff',
      severity: 'positive',
      headline: `Mortgage-free at age ${mortgagePayoffYear.age}`,
      detail: `Your mortgage will be fully paid off in ${mortgagePayoffYear.year}. After this, housing costs drop significantly.`,
      category: 'housing',
      importance: 72,
    });
  }

  // High mortgage-to-income ratio
  if (year0.endMortgageBalance > 0 && year0.grossIncome > 0) {
    const mortgageRatio = year0.totalMortgagePayments / year0.netIncome;
    if (mortgageRatio > 0.4) {
      insights.push({
        id: 'mortgage-heavy',
        severity: 'warning',
        headline: `${(mortgageRatio * 100).toFixed(0)}% of income goes to mortgage`,
        detail: `Mortgage payments consume a large share of net income. This pressure eases as principal is paid down.`,
        category: 'housing',
        importance: 55,
      });
    }
  }

  // ---- Investment Insights ----
  // Compound growth power: when returns exceed contributions
  const crossoverYear = summaries.find((s, i) =>
    i > 0 && s.investmentReturns > s.totalInvestmentContributions && s.totalInvestmentContributions > 0
  );
  if (crossoverYear) {
    insights.push({
      id: 'investment-crossover',
      severity: 'positive',
      headline: `Investment returns exceed contributions at age ${crossoverYear.age}`,
      detail: `By ${crossoverYear.year}, your money is working harder than you are — returns (${formatCompact(crossoverYear.investmentReturns)}) outpace new contributions (${formatCompact(crossoverYear.totalInvestmentContributions)}).`,
      category: 'investment',
      importance: 68,
    });
  }

  // Portfolio at retirement
  if (sim.projectedNetWorthAtRetirement > 0) {
    insights.push({
      id: 'retirement-nw',
      severity: 'info',
      headline: `${formatCompact(sim.projectedNetWorthAtRetirement)} projected at retirement`,
      detail: `At age ${scenario.retirement.targetAge}, your total projected net worth is ${formatCompact(sim.projectedNetWorthAtRetirement)}.`,
      category: 'general',
      importance: 35,
    });
  }

  // ---- Expense Growth Warning ----
  if (summaries.length > 10) {
    const year10 = summaries[9];
    const expenseGrowth = year10.totalExpenses / year0.totalExpenses;
    if (expenseGrowth > 1.5) {
      insights.push({
        id: 'expense-growth',
        severity: 'warning',
        headline: `Expenses grow ${((expenseGrowth - 1) * 100).toFixed(0)}% in 10 years`,
        detail: `Annual expenses increase from ${formatCompact(year0.totalExpenses)} to ${formatCompact(year10.totalExpenses)} by ${year10.year}. Inflation and lifestyle costs compound over time.`,
        category: 'general',
        importance: 45,
      });
    }
  }

  // Sort by importance and return top 8
  return insights
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8);
}

// ---- Helpers ----

function findSignificantDrop(
  summaries: AnnualSummary[],
  accessor: (s: AnnualSummary) => number,
  threshold: number,
): { summary: AnnualSummary; prev: number; current: number } | null {
  for (let i = 1; i < summaries.length; i++) {
    const prev = accessor(summaries[i - 1]);
    const current = accessor(summaries[i]);
    if (prev > 0 && (prev - current) / prev > threshold) {
      return { summary: summaries[i], prev, current };
    }
  }
  return null;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return `€${Math.round(value)}`;
}
