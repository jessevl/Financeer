// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HousingModule } from './HousingModule';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createDefaultScenario, defaultGlobalSettings } from '@/data/defaults';
import { useStore } from '@/store';
import { useUndoRedoStore } from '@/store/undoRedo';

function resetStore() {
  const scenario = createDefaultScenario('Housing UI test');
  scenario.housing.properties[0].startDate = '2028-02-01';
  scenario.housing.properties[0].mortgages[0].startDate = '2028-02-15';
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

describe('HousingModule', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    resetStore();
  });

  it('updates property lifecycle dates from the housing module', () => {
    render(
      <TooltipProvider>
        <HousingModule />
      </TooltipProvider>,
    );

    fireEvent.change(screen.getByDisplayValue('2028-02-01'), {
      target: { value: '2029-03-01' },
    });

    expect(useStore.getState().scenarios[0].housing.properties[0].startDate).toBe('2029-03-01');
  });
});