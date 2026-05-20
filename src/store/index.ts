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
  InvestmentAccount,
  RetirementConfig,
  ToeslagenConfig,
  LifeEvent,
} from '@/types';
import { createDefaultScenario, createInvestmentAccount, defaultGlobalSettings, defaultToeslagen, defaultTax, defaultIncome, defaultExpenses, defaultRetirement } from '@/data/defaults';
import { useUndoRedoStore } from './undoRedo';
import { normalizeChildcareArrangements } from '@/lib/childcare';
import { migrateModuleOwnedLifeEvents, normalizeLifeEvents } from '@/lib/lifeEvents';

function pushUndo() {
  useUndoRedoStore.getState().pushSnapshot();
}

const SCHEMA_VERSION = 1;

function normalizeImportedScenario<T extends { income: { hasPartner: boolean }; tax: { filingType: 'single' | 'couple' } }>(scenario: T): T {
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

function normalizeInvestments(investments: InvestmentConfig | undefined): InvestmentConfig {
  const legacyCash = investments?.currentSavings ?? 0;
  const normalizedAccounts = (investments?.accounts ?? []).map((account) => {
    const rawType = (account as { type?: string }).type ?? 'brokerage';
    const normalizedType: InvestmentAccount['type'] = rawType === 'pension'
      ? 'lijfrente'
      : rawType === 'real-estate'
        ? 'real-estate'
        : rawType === 'lijfrente'
          ? 'lijfrente'
          : rawType === 'savings'
            ? 'savings'
            : 'brokerage';
    const base = createInvestmentAccount(normalizedType, { ...account, type: normalizedType });
    if (normalizedType === 'savings') {
      return {
        ...base,
        volatility: 0,
        expenseRatio: 0,
        reinvestDividends: false,
      };
    }
    return base;
  });

  if (normalizedAccounts.length === 0 || !normalizedAccounts.some((account) => account.type === 'savings')) {
    normalizedAccounts.unshift(createInvestmentAccount('savings', { balance: legacyCash }));
  } else if (legacyCash > 0) {
    const savingsIndex = normalizedAccounts.findIndex((account) => account.type === 'savings');
    normalizedAccounts[savingsIndex] = {
      ...normalizedAccounts[savingsIndex],
      balance: normalizedAccounts[savingsIndex].balance + legacyCash,
    };
  }

  const eligibleSweepAccounts = normalizedAccounts.filter((account) => account.type !== 'lijfrente');
  const autoSweepAccountId = eligibleSweepAccounts.some((account) => account.id === investments?.autoSweepAccountId)
    ? investments?.autoSweepAccountId
    : eligibleSweepAccounts[0]?.id;

  return {
    ...investments,
    currentSavings: undefined,
    emergencyFund: investments?.emergencyFund ?? 0,
    autoSweepAccountId,
    accounts: normalizedAccounts,
  };
}

function normalizeCareerEvents(events: any[] | undefined, income: IncomeConfig | undefined): any[] {
  return (events ?? []).map((event) => ({
    ...event,
    type: event.type ?? 'salary_change',
    salaryChangeMode: event.salaryChangeMode ?? 'set',
    newGrossSalary: event.newGrossSalary ?? event.amount ?? income?.grossSalary ?? 0,
    annualSalaryDelta: event.annualSalaryDelta,
    durationMonths: event.durationMonths,
    incomeReplacementRate: event.incomeReplacementRate,
    monthlyExpenseChange: event.monthlyExpenseChange ?? 0,
  }));
}

function normalizeScenarioModules<T extends { income: IncomeConfig; expenses: ExpenseConfig; housing: HousingConfig; lifeEvents: LifeEvent[] }>(scenario: T): T {
  const migrated = migrateModuleOwnedLifeEvents({
    lifeEvents: scenario.lifeEvents,
    income: scenario.income,
    expenses: scenario.expenses,
    housing: scenario.housing,
  });

  return {
    ...scenario,
    income: migrated.income,
    expenses: migrated.expenses,
    housing: migrated.housing,
    lifeEvents: migrated.lifeEvents,
  };
}

function normalizeProperties(properties: any[] | undefined): any[] {
  return (properties ?? []).map((property) => ({
    ...property,
    startDate: property.startDate ?? property.mortgages?.[0]?.startDate ?? property.mortgage?.startDate ?? '2024-01-01',
    endDate: property.endDate,
    purchaseCosts: property.purchaseCosts ?? 0,
    sellingCosts: property.sellingCosts ?? 0,
    salePrice: property.salePrice,
    mortgages: (property.mortgages ?? (property.mortgage ? [{ ...property.mortgage, id: property.mortgage.id ?? property.id + '-m0', label: 'Mortgage' }] : [])).map((mortgage: any) => ({
      ...mortgage,
      deductibilityStartDate: mortgage.deductibilityStartDate ?? mortgage.startDate ?? new Date().toISOString().slice(0, 10),
    })),
  }));
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
              ? { ...s, income, updatedAt: new Date().toISOString() }
              : s
          ),
        }));
      },

      updateTax: (scenarioId, tax) => {
        pushUndo();
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId
              ? { ...s, tax, updatedAt: new Date().toISOString() }
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
        const normalizedInvestments = normalizeInvestments(investments);
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === scenarioId ? { ...s, investments: normalizedInvestments, updatedAt: new Date().toISOString() } : s
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
            s.id === scenarioId ? { ...s, lifeEvents: normalizeLifeEvents(events), updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      importData: (data) => {
        const normalizedScenarios = data.scenarios.map((s) =>
          normalizeScenarioModules(normalizeImportedScenario({
            ...s,
            income: {
              ...s.income,
              partnerThirteenthMonth: s.income?.partnerThirteenthMonth ?? defaultIncome.partnerThirteenthMonth,
              partnerBonusAmount: s.income?.partnerBonusAmount ?? defaultIncome.partnerBonusAmount,
              box2Income: s.income?.box2Income ?? 0,
              careerEvents: normalizeCareerEvents(s.income?.careerEvents, s.income),
            },
            expenses: {
              ...defaultExpenses,
              ...s.expenses,
              children: (s.expenses?.children ?? []).map((c: any) => ({
                ...c,
                childcareArrangements: normalizeChildcareArrangements(c),
                kinderopvangType: c.kinderopvangType ?? 'none',
                kinderopvangHoursPerMonth: c.kinderopvangHoursPerMonth ?? 0,
                kinderopvangHourlyRate: c.kinderopvangHourlyRate ?? 0,
                kinderopvangStartDate: c.kinderopvangStartDate,
                kinderopvangEndDate: c.kinderopvangEndDate,
              })),
              partnerHealthcareMonthlyPremium: s.expenses?.partnerHealthcareMonthlyPremium ?? defaultExpenses.partnerHealthcareMonthlyPremium,
              partnerHealthcareDeductible: s.expenses?.partnerHealthcareDeductible ?? defaultExpenses.partnerHealthcareDeductible,
            },
            tax: {
              ...s.tax,
              box2: s.tax?.box2 ?? defaultTax.box2,
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
            toeslagen: {
              ...(s.toeslagen ?? defaultToeslagen),
              kinderopvangtoeslag: s.toeslagen?.kinderopvangtoeslag ?? defaultToeslagen.kinderopvangtoeslag,
              huurtoeslag: s.toeslagen?.huurtoeslag ?? defaultToeslagen.huurtoeslag,
            },
            retirement: {
              ...defaultRetirement,
              ...s.retirement,
              retirementCalculationMethod: s.retirement?.retirementCalculationMethod
                ?? (s.retirement?.retirementTargetMode === 'manual' ? 'swr' : 'present-value'),
              retirementTargetMode: s.retirement?.retirementTargetMode ?? defaultRetirement.retirementTargetMode,
              pensionStartAge: s.retirement?.pensionStartAge ?? s.retirement?.targetAge ?? 67,
              legacyTargetAmount: s.retirement?.legacyTargetAmount ?? defaultRetirement.legacyTargetAmount,
              partnerAowMonthlyAmount: s.retirement?.partnerAowMonthlyAmount ?? s.retirement?.aowMonthlyAmount ?? defaultRetirement.partnerAowMonthlyAmount,
              partnerPensionMonthlyAmount: s.retirement?.partnerPensionMonthlyAmount ?? defaultRetirement.partnerPensionMonthlyAmount,
              withdrawalStrategy: s.retirement?.withdrawalStrategy ?? 'tax-efficient',
              pensionType: s.retirement?.pensionType ?? 'fixed',
              pensionAccrualRate: s.retirement?.pensionAccrualRate ?? defaultRetirement.pensionAccrualRate,
              pensionFranchise: s.retirement?.pensionFranchise ?? defaultRetirement.pensionFranchise,
              pensionServiceStartAge: s.retirement?.pensionServiceStartAge ?? defaultRetirement.pensionServiceStartAge,
              pensionPartTimeFactor: s.retirement?.pensionPartTimeFactor ?? defaultRetirement.pensionPartTimeFactor,
              pensionEarlyRetirementPenalty: s.retirement?.pensionEarlyRetirementPenalty ?? defaultRetirement.pensionEarlyRetirementPenalty,
            },
            investments: {
              ...normalizeInvestments(s.investments),
            },
            housing: {
              ...s.housing,
              properties: normalizeProperties(s.housing?.properties),
            },
            lifeEvents: normalizeLifeEvents(s.lifeEvents),
          }))
        );

        const activeScenarioId = normalizedScenarios.some((s) => s.id === data.activeScenarioId)
          ? data.activeScenarioId
          : normalizedScenarios[0]?.id;

        set({
          scenarios: normalizedScenarios,
          settings: { ...defaultGlobalSettings, ...data.settings },
          activeScenarioId,
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
            childcareArrangements: normalizeChildcareArrangements(c),
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

          return normalizeScenarioModules(normalizeImportedScenario({
            ...s,
            lifeEvents: normalizeLifeEvents(s.lifeEvents),
            income: {
              ...s.income,
              partnerThirteenthMonth: s.income?.partnerThirteenthMonth ?? defaultIncome.partnerThirteenthMonth,
              partnerBonusAmount: s.income?.partnerBonusAmount ?? defaultIncome.partnerBonusAmount,
              box2Income: s.income?.box2Income ?? 0,
              careerEvents: normalizeCareerEvents(s.income?.careerEvents, s.income),
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
              properties: normalizeProperties(s.housing?.properties),
            },
            retirement: {
              ...defaultRetirement,
              ...s.retirement,
              pensionStartAge: s.retirement?.pensionStartAge ?? s.retirement?.targetAge ?? 67,
              partnerAowMonthlyAmount: s.retirement?.partnerAowMonthlyAmount ?? s.retirement?.aowMonthlyAmount ?? defaultRetirement.partnerAowMonthlyAmount,
              partnerPensionMonthlyAmount: s.retirement?.partnerPensionMonthlyAmount ?? defaultRetirement.partnerPensionMonthlyAmount,
              withdrawalStrategy: s.retirement?.withdrawalStrategy ?? 'tax-efficient',
              pensionType: s.retirement?.pensionType ?? 'fixed',
              pensionAccrualRate: s.retirement?.pensionAccrualRate ?? defaultRetirement.pensionAccrualRate,
              pensionFranchise: s.retirement?.pensionFranchise ?? defaultRetirement.pensionFranchise,
              pensionServiceStartAge: s.retirement?.pensionServiceStartAge ?? defaultRetirement.pensionServiceStartAge,
              pensionPartTimeFactor: s.retirement?.pensionPartTimeFactor ?? defaultRetirement.pensionPartTimeFactor,
              pensionEarlyRetirementPenalty: s.retirement?.pensionEarlyRetirementPenalty ?? defaultRetirement.pensionEarlyRetirementPenalty,
            },
            investments: {
              ...normalizeInvestments(s.investments),
            },
          }));
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
