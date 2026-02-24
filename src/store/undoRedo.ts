// ============================================================
// Undo / Redo History Store
// Tracks snapshots of the serialised scenarios array.
// Uses a simple circular-buffer approach with max 50 entries.
// ============================================================

import { create } from 'zustand';
import { useStore } from '@/store';
import type { Scenario } from '@/types';

const MAX_HISTORY = 50;

interface HistoryEntry {
  scenarios: string;           // JSON-serialised scenarios
  activeScenarioId: string;
  timestamp: number;
}

interface UndoRedoStore {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Must be called before every mutation to push current state onto the undo stack */
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function captureSnapshot(): HistoryEntry {
  const { scenarios, activeScenarioId } = useStore.getState();
  return {
    scenarios: JSON.stringify(scenarios),
    activeScenarioId,
    timestamp: Date.now(),
  };
}

function restoreSnapshot(entry: HistoryEntry): void {
  const parsed: Scenario[] = JSON.parse(entry.scenarios);
  // Directly set state without triggering another history push
  useStore.setState({
    scenarios: parsed,
    activeScenarioId: entry.activeScenarioId,
  });
}

export const useUndoRedoStore = create<UndoRedoStore>()((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushSnapshot: () => {
    const snapshot = captureSnapshot();
    set((state) => {
      const newPast = [...state.past, snapshot].slice(-MAX_HISTORY);
      return { past: newPast, future: [], canUndo: true, canRedo: false };
    });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    // Save current state to future
    const currentSnapshot = captureSnapshot();
    const previous = past[past.length - 1];

    restoreSnapshot(previous);

    set((state) => {
      const newPast = state.past.slice(0, -1);
      const newFuture = [currentSnapshot, ...state.future];
      return {
        past: newPast,
        future: newFuture,
        canUndo: newPast.length > 0,
        canRedo: true,
      };
    });
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    // Save current state to past
    const currentSnapshot = captureSnapshot();
    const next = future[0];

    restoreSnapshot(next);

    set((state) => {
      const newFuture = state.future.slice(1);
      const newPast = [...state.past, currentSnapshot];
      return {
        past: newPast,
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      };
    });
  },
}));

// ---- Convenience hooks ----

export function useUndo() {
  return useUndoRedoStore((s) => ({ undo: s.undo, canUndo: s.canUndo }));
}

export function useRedo() {
  return useUndoRedoStore((s) => ({ redo: s.redo, canRedo: s.canRedo }));
}

export function usePushSnapshot() {
  return useUndoRedoStore((s) => s.pushSnapshot);
}
