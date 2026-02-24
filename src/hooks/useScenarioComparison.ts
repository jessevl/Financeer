import { useMemo } from 'react';
import { useStore, useSettings } from '@/store';
import { runSimulation } from '@/engine/simulation';
import type { Scenario, SimulationResult } from '@/types';

export interface ScenarioSimResult {
  scenario: Scenario;
  simulation: SimulationResult;
}

/**
 * Runs simulations for all scenarios and returns results keyed by scenario id.
 * Memoised on the scenarios array and settings to avoid redundant computation.
 */
export function useScenarioComparison(): ScenarioSimResult[] {
  const scenarios = useStore((s) => s.scenarios);
  const settings = useSettings();

  return useMemo(() => {
    return scenarios.map((scenario) => ({
      scenario,
      simulation: runSimulation(scenario, settings),
    }));
  }, [scenarios, settings]);
}
