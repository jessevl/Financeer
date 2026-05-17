import { describe, expect, it } from 'vitest';
import { createDefaultScenario, defaultGlobalSettings } from '@/data/defaults';
import { validateImport } from './importSchema';

function makeImportPayload() {
  const scenario = createDefaultScenario('Import test');
  return {
    scenarios: [scenario],
    settings: defaultGlobalSettings,
    activeScenarioId: scenario.id,
  };
}

describe('validateImport', () => {
  it('rejects salary-change events without a salary payload', () => {
    const payload = makeImportPayload();
    payload.scenarios[0].lifeEvents = [
      {
        id: 'event-1',
        type: 'salary_change',
        date: '2026-06',
        label: 'Promotion',
      } as any,
    ];

    const result = validateImport(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join('\n')).toContain('Salary change must include annualSalary, annualSalaryDelta, or legacy amount');
    }
  });

  it('rejects malformed property-sale events before store normalization', () => {
    const payload = makeImportPayload();
    payload.scenarios[0].lifeEvents = [
      {
        id: 'event-2',
        type: 'sell_property',
        date: '2027-03',
        label: 'Sell rental',
        salePrice: 350000,
      } as any,
    ];

    const result = validateImport(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join('\n')).toContain('Property sale must include propertyId');
    }
  });

  it('accepts legacy cash events that still normalize later', () => {
    const payload = makeImportPayload();
    payload.scenarios[0].lifeEvents = [
      {
        id: 'event-3',
        type: 'inheritance',
        date: '2026-01',
        name: 'Legacy inheritance',
        amount: 50000,
      } as any,
    ];

    const result = validateImport(payload);

    expect(result.success).toBe(true);
  });
});