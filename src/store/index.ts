import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Scenario,
  GlobalSettings,
  IncomeConfig,
  TaxConfig,
  ExpenseConfig,
  HousingConfig,
  InvestmentConfig,
  RetirementConfig,
  ToeslagenConfig,
  LifeEvent,
} from '@/types';
import { createDefaultScenario, defaultGlobalSettings, defaultToeslagen, defaultTax, defaultIncome, defaultExpenses } from '@/data/defaults';
import { useUndoRedoStore } from './undoRedo';

function pushUndo() {
  useUndoRedoStore.getState().pushSnapshot();
}

const SCHEMA_VERSION = 1;

function enforcePartnerFilingType<T extends { income: { hasPartner: boolean }; tax: { filingType: 'single' | 'couple' } }>(scenario: T): T {
  if (!scenario.income.hasPartner) return scenario;
  if (scenario.tax.filingType === 'couple') return scenario;
  return {
    ...scenario,
    tax: {
      ...scenario.tax,
      filingType: 'couple',
    },
  };
}

interface FinanceerStore {
  schemaVersion: number;
  activeScenarioId: string;
  scenarios: Scenario[];
  settings: GlobalSettings;

  // Scenario actions
  createScenario: (name?: string) => void;
  duplicateScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  renameScenario: (id: string, name: string) => void;
  setActiveScenario: (id: string) => void;

  // Module update actions
  updateIncome: (scenarioId: string, income: IncomeConfig) => void;
  updateTax: (scenarioId: string, tax: TaxConfig) => void;
  updateExpenses: (scenarioId: string, expenses: ExpenseConfig) => void;
  updateHousing: (scenarioId: string, housing: HousingConfig) => void;
  updateInvestments: (scenarioId: string, investments: InvestmentConfig) => void;
  updateRetirement: (scenarioId: string, retirement: RetirementConfig) => void;
  updateToeslagen: (scenarioId: string, toeslagen: ToeslagenConfig) => void;
  updateLifeEvents: (scenarioId: string, events: LifeEvent[]) => void;

  // Settings actions
  updateSettings: (settings: Partial<GlobalSettings>) => void;

  // Import/Export
  importData: (data: { scenarios: Scenario[]; settings: GlobalSettings; activeScenarioId: string }) => void;
  resetAll: () => void;
}

const initialScenario = createDefaultScenario();

export const useStore = create<FinanceerStore>()(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      activeScenarioId: initialScenario.id,
      scenarios: [initialScenario],
      settings: { ...defaultGlobalSettings },

      createScenario: (name) => {
        const scenario = createDefaultScenario(name || `Scenario ${get().scenarios.length + 1}`);
        set((state) => ({
          scenarios: [...state.scenarios, scenario],
          activeScenarioId: scenario.id,
        }));
      },

      duplicateScenario: (id) => {
        pushUndo();
        const source = get().scenarios.find((s) => s.id === id);
        if (!source) return;
        const now = new Date().toISOString();
        const newScenario: Scenario = {
          ...JSON.parse(JSON.stringify(source)),
          id: uuidv4(),
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          scenarios: [...state.scenarios, newScenario],
          activeScenarioId: newScenario.id,
        }));
      },

      deleteScenario: (id) => {
        pushUndo();
        const { scenarios, activeScenarioId } = get();
        if (scenarios.length <= 1) return; // Don't delete last scenario
        const filtered = scenarios.filter((s) => s.id !== id);
        set({
          scenarios: filtered,
          activeScenarioId: activeScenarioId === id ? filtered[0].id : activeScenarioId,
        });
      },

      renameScenario: (id, name) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      setActiveScenario: (id) => {
        set({ activeScenarioId: id });
      },

      updateIncome: (scenarioId, income) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId
              ? enforcePartnerFilingType({ ...s, income, updatedAt: new Date().toISOString() })
              : s
          ),
        }));
      },

      updateTax: (scenarioId, tax) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId
              ? enforcePartnerFilingType({ ...s, tax, updatedAt: new Date().toISOString() })
              : s
          ),
        }));
      },

      updateExpenses: (scenarioId, expenses) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, expenses, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      updateHousing: (scenarioId, housing) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, housing, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      updateInvestments: (scenarioId, investments) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, investments, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      updateRetirement: (scenarioId, retirement) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, retirement, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      updateToeslagen: (scenarioId, toeslagen) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, toeslagen, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      updateLifeEvents: (scenarioId, events) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, lifeEvents: events, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      importData: (data) => {
        set({
          scenarios: data.scenarios.map(enforcePartnerFilingType),
          settings: data.settings,
          activeScenarioId: data.activeScenarioId,
        });
      },

      resetAll: () => {
        const scenario = createDefaultScenario();
        set({
          schemaVersion: SCHEMA_VERSION,
          activeScenarioId: scenario.id,
          scenarios: [scenario],
          settings: { ...defaultGlobalSettings },
        });
      },
    }),
    {
      name: 'financeer-storage',
      storage: createJSONStorage(() => localStorage),
      version: SCHEMA_VERSION,
      // Merge persisted settings with defaults so new fields get their default values
      merge: (persisted, current) => {
        const state = persisted as Partial<FinanceerStore> | undefined;
        if (!state) return current;
        // Ensure all scenarios have toeslagen config and mortgages array (migration for old data)
        const scenarios = (state.scenarios ?? current.scenarios).map((s) => {
          // Migrate children: add kinderopvang fields if missing
          const migratedChildren = (s.expenses?.children ?? []).map((c: any) => ({
            ...c,
            kinderopvangType: c.kinderopvangType ?? 'none',
            kinderopvangHoursPerMonth: c.kinderopvangHoursPerMonth ?? 0,
            kinderopvangHourlyRate: c.kinderopvangHourlyRate ?? 0,
          }));

          // Migrate kinderopvangtoeslag: old shape had maxHourlyRate/numberOfChildren/hoursPerMonth
          const kt = s.toeslagen?.kinderopvangtoeslag;
          const needsKtMigration = kt && !('maxHourlyRateDaycare' in kt);
          const migratedKinderopvangtoeslag = needsKtMigration
            ? defaultToeslagen.kinderopvangtoeslag
            : (kt ?? defaultToeslagen.kinderopvangtoeslag);

          return enforcePartnerFilingType({
            ...s,
            income: {
              ...s.income,
              partnerThirteenthMonth: s.income?.partnerThirteenthMonth ?? defaultIncome.partnerThirteenthMonth,
              partnerBonusAmount: s.income?.partnerBonusAmount ?? defaultIncome.partnerBonusAmount,
              box2Income: s.income?.box2Income ?? 0,
            },
            toeslagen: {
              ...(s.toeslagen ?? defaultToeslagen),
              kinderopvangtoeslag: migratedKinderopvangtoeslag,
              huurtoeslag: s.toeslagen?.huurtoeslag ?? defaultToeslagen.huurtoeslag,
            },
            expenses: {
              ...defaultExpenses,
              ...s.expenses,
              children: migratedChildren,
              partnerHealthcareMonthlyPremium: s.expenses?.partnerHealthcareMonthlyPremium ?? defaultExpenses.partnerHealthcareMonthlyPremium,
              partnerHealthcareDeductible: s.expenses?.partnerHealthcareDeductible ?? defaultExpenses.partnerHealthcareDeductible,
            },
            tax: {
              ...s.tax,
              box2: s.tax?.box2 ?? (s.tax as any)?.box2Rate
                ? { lowerRate: 0.245, lowerBracketLimit: 67000, upperRate: 0.33 }
                : defaultTax.box2,
              box3: {
                ...s.tax?.box3,
                debtThreshold: s.tax?.box3?.debtThreshold ?? defaultTax.box3.debtThreshold,
              },
              iack: s.tax?.iack ?? defaultTax.iack,
              ouderenkorting: s.tax?.ouderenkorting ?? defaultTax.ouderenkorting,
              jonggehandicaptenkorting: s.tax?.jonggehandicaptenkorting ?? defaultTax.jonggehandicaptenkorting,
              jonggehandicaptEnabled: s.tax?.jonggehandicaptEnabled ?? defaultTax.jonggehandicaptEnabled,
              selfEmployment: s.tax?.selfEmployment ?? defaultTax.selfEmployment,
              taxOptimizations: {
                ...defaultTax.taxOptimizations,
                ...s.tax?.taxOptimizations,
                alimentatie: s.tax?.taxOptimizations?.alimentatie ?? 0,
              },
            },
            housing: {
              ...s.housing,
              properties: (s.housing?.properties ?? []).map((p: any) => ({
                ...p,
                // Migrate single mortgage → mortgages array
                mortgages: (p.mortgages ?? (p.mortgage ? [{ ...p.mortgage, id: p.mortgage.id ?? p.id + '-m0', label: 'Mortgage' }] : [])).map((m: any) => ({
                  ...m,
                  deductibilityStartDate: m.deductibilityStartDate ?? m.startDate ?? new Date().toISOString().slice(0, 10),
                })),
              })),
            },
            retirement: {
              ...s.retirement,
              withdrawalStrategy: s.retirement?.withdrawalStrategy ?? 'tax-efficient',
            },
            investments: {
              ...s.investments,
              accounts: (s.investments?.accounts ?? []).map((a: any) => ({
                ...a,
                volatility: a.volatility ?? 0.15,
              })),
            },
          });
        });
        return {
          ...current,
          ...state,
          scenarios,
          settings: { ...defaultGlobalSettings, ...state.settings },
        };
      },
    }
  )
);

// Selector hooks for convenience
export const useActiveScenario = () => {
  return useStore((s) => {
    return s.scenarios.find((sc) => sc.id === s.activeScenarioId) ?? s.scenarios[0];
  });
};

export const useSettings = () => useStore((s) => s.settings);
