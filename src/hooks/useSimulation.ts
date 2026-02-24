// ============================================================
// useSimulation — runs the simulation engine, using a Web Worker
// when available for off-main-thread execution.
// Falls back to synchronous calculation on first render or if
// the worker is unavailable.
// ============================================================

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useActiveScenario, useSettings } from '@/store';
import { runSimulation } from '@/engine/simulation';
import type { SimulationResult, Scenario, GlobalSettings } from '@/types';
import type { SimWorkerRequest, SimWorkerResponse } from '@/engine/simulation.worker';

// Singleton worker instance (created once, shared across hook instances)
let workerInstance: Worker | null = null;
let workerFailed = false;
let nextRequestId = 0;
const pendingCallbacks = new Map<number, (result: SimulationResult) => void>();

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (workerInstance) return workerInstance;

  try {
    workerInstance = new Worker(
      new URL('@/engine/simulation.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerInstance.onmessage = (e: MessageEvent<SimWorkerResponse>) => {
      const cb = pendingCallbacks.get(e.data.id);
      if (cb) {
        pendingCallbacks.delete(e.data.id);
        cb(e.data.result);
      }
    };
    workerInstance.onerror = () => {
      workerFailed = true;
      workerInstance = null;
    };
    return workerInstance;
  } catch {
    workerFailed = true;
    return null;
  }
}

function postToWorker(scenario: Scenario, settings: GlobalSettings): Promise<SimulationResult> | null {
  const w = getWorker();
  if (!w) return null;

  const id = ++nextRequestId;
  return new Promise((resolve) => {
    pendingCallbacks.set(id, resolve);
    w.postMessage({ id, scenario, settings } satisfies SimWorkerRequest);
  });
}

export function useSimulation(): SimulationResult {
  const scenario = useActiveScenario();
  const settings = useSettings();

  // Synchronous fallback ensures we always have a result immediately
  const syncResult = useMemo(() => runSimulation(scenario, settings), [scenario, settings]);
  const [workerResult, setWorkerResult] = useState<SimulationResult | null>(null);

  // Track whether the worker result matches the current inputs
  const latestRef = useRef(0);

  const triggerWorker = useCallback((s: Scenario, g: GlobalSettings) => {
    const version = ++latestRef.current;
    const promise = postToWorker(s, g);
    if (!promise) return; // No worker, use sync
    promise.then((result) => {
      // Only apply if this is still the latest request
      if (latestRef.current === version) {
        setWorkerResult(result);
      }
    });
  }, []);

  useEffect(() => {
    triggerWorker(scenario, settings);
  }, [scenario, settings, triggerWorker]);

  // Use worker result when available and fresh, otherwise sync
  return workerResult ?? syncResult;
}
