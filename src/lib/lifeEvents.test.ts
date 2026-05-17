import { describe, expect, it } from 'vitest';
import { createDefaultScenario } from '@/data/defaults';
import { createDefaultLifeEvent, migrateModuleOwnedLifeEvents } from './lifeEvents';

describe('migrateModuleOwnedLifeEvents', () => {
  it('moves legacy module-owned life events into income, expenses, and housing', () => {
    const scenario = createDefaultScenario('Migration test');
    scenario.lifeEvents = [
      {
        ...createDefaultLifeEvent('salary_change'),
        id: 'salary-1',
        date: '2027-03',
        annualSalary: 90000,
      },
      {
        ...createDefaultLifeEvent('child_born'),
        id: 'child-1',
        date: '2028-07',
        childName: 'Nova',
      },
      {
        ...createDefaultLifeEvent('buy_property'),
        id: 'property-1',
        date: '2029-01',
        propertyId: 'future-home',
        propertyLabel: 'Future home',
        propertyValue: 450000,
        propertyWozValue: 430000,
        propertyPurchaseCosts: 12000,
      },
      {
        ...createDefaultLifeEvent('cash_windfall'),
        id: 'cash-1',
        date: '2030-05',
        cashAmount: 25000,
      },
    ];

    const migrated = migrateModuleOwnedLifeEvents({
      lifeEvents: scenario.lifeEvents,
      income: scenario.income,
      expenses: scenario.expenses,
      housing: scenario.housing,
    });

    expect(migrated.lifeEvents).toHaveLength(1);
    expect(migrated.lifeEvents[0].type).toBe('cash_windfall');
    expect(migrated.income.careerEvents.some((event) => event.id === 'salary-1' && event.type === 'salary_change')).toBe(true);
    expect(migrated.expenses.children.some((child) => child.name === 'Nova' && child.birthDate === '2028-07-01')).toBe(true);
    expect(migrated.housing.properties.some((property) => property.id === 'future-home' && property.startDate === '2029-01-01' && property.purchaseCosts === 12000)).toBe(true);
  });
});