// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IncomeModule } from './IncomeModule';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createDefaultScenario, defaultGlobalSettings } from '@/data/defaults';
import { useStore } from '@/store';
import { useUndoRedoStore } from '@/store/undoRedo';

function resetStore() {
  const scenario = createDefaultScenario('Income UI test');
  useStore.setState({
    schemaVersion: 1,
    activeScenarioId: scenario.id,
    scenarios: [scenario],
    settings: { ...defaultGlobalSettings },
  });
  useUndoRedoStore.setState({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });
}

describe('IncomeModule', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    resetStore();
  });

  it('adds salary-change career events from the income module', () => {
    render(
      <TooltipProvider>
        <IncomeModule />
      </TooltipProvider>,
    );

    const careerHeader = screen.getByText('Career Events').closest('[data-slot="card-header"]');
    expect(careerHeader).toBeTruthy();
    fireEvent.click(within(careerHeader as HTMLElement).getByRole('button', { name: /add/i }));

    const careerEvents = useStore.getState().scenarios[0].income.careerEvents;
    expect(careerEvents).toHaveLength(1);
    expect(careerEvents[0].type).toBe('salary_change');
    expect(careerEvents[0].salaryChangeMode).toBe('set');
    expect(careerEvents[0].newGrossSalary).toBe(useStore.getState().scenarios[0].income.grossSalary);
    expect(screen.getByText('Mode')).toBeTruthy();
  });
});