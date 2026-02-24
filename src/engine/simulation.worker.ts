// ============================================================
// Simulation Web Worker
// Runs runSimulation() off the main thread.
// Vite handles bundling this file via `new Worker(url, { type: 'module' })`.
// ============================================================

import { runSimulation } from '@/engine/simulation';
import type { Scenario, GlobalSettings } from '@/types';

export interface SimWorkerRequest {
  id: number;
  scenario: Scenario;
  settings: GlobalSettings;
}

export interface SimWorkerResponse {
  id: number;
  result: ReturnType<typeof runSimulation>;
}

self.onmessage = (e: MessageEvent<SimWorkerRequest>) => {
  const { id, scenario, settings } = e.data;
  const result = runSimulation(scenario, settings);
  (self as unknown as Worker).postMessage({ id, result } satisfies SimWorkerResponse);
};
