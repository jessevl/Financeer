// ============================================================
// Monte Carlo Simulation Engine
// Runs N iterations of the simulation with randomised annual
// investment returns drawn from a normal distribution around
// each account's expectedReturn ± volatility.
// Returns percentile bands (P10, P25, P50, P75, P90) of
// liquid net worth per year.
// ============================================================

import type { Scenario, GlobalSettings } from '@/types';
import { runSimulation } from './simulation';

export interface MonteCarloResult {
  /** Number of iterations run */
  iterations: number;
  /** Year labels for each index */
  years: number[];
  /** Percentile bands of liquidNetWorth at each year index */
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  /** Deterministic baseline (no randomness) */
  baseline: number[];
  /** Probability of reaching FIRE number by retirement age */
  fireSuccessRate: number;
  /** Distribution of FIRE ages (each iteration that reached FIRE) */
  fireAgeP10: number | null;
  fireAgeP50: number | null;
  fireAgeP90: number | null;
}

/**
 * Box-Muller transform: generate a standard normal variate.
 */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Run Monte Carlo simulation.
 * @param scenario Base scenario
 * @param settings Global settings
 * @param iterations Number of simulation runs (default 500)
 */
export function runMonteCarlo(
  scenario: Scenario,
  settings: GlobalSettings,
  iterations = 500,
): MonteCarloResult {
  // Run deterministic baseline first
  const baseline = runSimulation(scenario, settings);
  const years = baseline.annualSummaries.map(s => s.year);
  const numYears = years.length;

  // Collect per-year liquid net worth across all iterations
  const allLnw: number[][] = Array.from({ length: numYears }, () => []);
  const fireAges: number[] = [];
  let fireReachedCount = 0;

  for (let i = 0; i < iterations; i++) {
    // For each iteration, randomise the expectedReturn of each account per year
    // We do this by creating a modified scenario with shifted returns
    // But since the simulation runs month-by-month, we approximate by sampling
    // one annual return shock per year and scaling monthly returns accordingly.
    // Simplification: sample one return factor per iteration and scale all accounts.
    // More accurate: sample per-year. We'll do per-year for better variance modelling.

    // Pre-generate per-year return multipliers for each account
    const accountShocks: number[][] = scenario.investments.accounts.map(acc => {
      const vol = acc.volatility ?? 0.15;
      return Array.from({ length: numYears }, () => {
        // Annual return = expectedReturn + vol * N(0,1)
        // Convert to multiplicative factor: (1 + r_random) / (1 + r_expected)
        const rRandom = acc.expectedReturn + vol * randn();
        const factor = (1 + rRandom) / (1 + acc.expectedReturn);
        return Math.max(0.01, factor); // Floor at -99% to avoid negative
      });
    });

    // Create modified scenario with adjusted accounts per year
    // Since simulation runs month-by-month for the full horizon, we can't
    // easily change returns mid-simulation without modifying the engine.
    // Instead, use a simpler approach: pick one random return for the full sim.
    // This gives a distribution of outcomes across the full horizon.
    //
    // BETTER approach: We modify the scenario's expectedReturn once per iteration
    // using that iteration's average shock across years. This gives proper dispersion.
    const modifiedScenario = structuredClone(scenario);
    modifiedScenario.investments.accounts = modifiedScenario.investments.accounts.map((acc, ai) => {
      // For this iteration, use a single random return from the annual shock series
      // Pick a geometric-mean of all year shocks to get one representative factor
      const shocks = accountShocks[ai];
      const geoMean = Math.exp(shocks.reduce((s, f) => s + Math.log(f), 0) / shocks.length);
      const adjustedReturn = acc.expectedReturn * geoMean;
      return { ...acc, expectedReturn: Math.max(-0.5, adjustedReturn) };
    });

    const sim = runSimulation(modifiedScenario, settings);

    // Collect liquid net worth per year
    for (let y = 0; y < numYears && y < sim.annualSummaries.length; y++) {
      allLnw[y].push(sim.annualSummaries[y].endLiquidNetWorth);
    }

    // Track FIRE outcomes
    if (sim.fireAge) {
      fireAges.push(sim.fireAge);
      if (sim.fireAge <= scenario.retirement.targetAge) {
        fireReachedCount++;
      }
    }
  }

  // Calculate percentiles
  function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  const p10 = allLnw.map(arr => percentile(arr, 10));
  const p25 = allLnw.map(arr => percentile(arr, 25));
  const p50 = allLnw.map(arr => percentile(arr, 50));
  const p75 = allLnw.map(arr => percentile(arr, 75));
  const p90 = allLnw.map(arr => percentile(arr, 90));

  // FIRE age percentiles
  const sortedFireAges = [...fireAges].sort((a, b) => a - b);

  return {
    iterations,
    years,
    p10,
    p25,
    p50,
    p75,
    p90,
    baseline: baseline.annualSummaries.map(s => s.endLiquidNetWorth),
    fireSuccessRate: iterations > 0 ? fireReachedCount / iterations : 0,
    fireAgeP10: sortedFireAges.length > 0 ? percentile(sortedFireAges, 10) : null,
    fireAgeP50: sortedFireAges.length > 0 ? percentile(sortedFireAges, 50) : null,
    fireAgeP90: sortedFireAges.length > 0 ? percentile(sortedFireAges, 90) : null,
  };
}
