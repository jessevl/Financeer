import { v4 as uuidv4 } from 'uuid';
import type {
  CareerEvent,
  ChildConfig,
  ChildcareArrangement,
  ExpenseConfig,
  HousingConfig,
  IncomeConfig,
  LifeEvent,
  LifeEventType,
  MortgageConfig,
  Property,
} from '@/types';

type LegacyLifeEventType = LifeEventType | 'inheritance' | 'lump_sum' | 'custom';
type LegacyLifeEvent = Omit<LifeEvent, 'type'> & { type: LegacyLifeEventType };

export const genericLifeEventTypes: LifeEventType[] = ['partner_change', 'cash_windfall', 'one_time_expense'];

function normalizeMortgageConfig(raw: MortgageConfig): MortgageConfig {
  return {
    ...raw,
    id: raw.id || uuidv4(),
    label: raw.label || 'Mortgage',
    extraRepayments: raw.extraRepayments ?? [],
    deductibilityStartDate: raw.deductibilityStartDate ?? raw.startDate,
    nhg: raw.nhg ?? false,
  };
}

function normalizeChildcareArrangement(arrangement: ChildcareArrangement): ChildcareArrangement {
  return {
    ...arrangement,
    id: arrangement.id || uuidv4(),
    hoursPerMonth: arrangement.hoursPerMonth ?? 0,
    hourlyRate: arrangement.hourlyRate ?? 0,
  };
}

export function normalizeLifeEvent(rawEvent: LifeEvent): LifeEvent {
  const event = { ...rawEvent } as LegacyLifeEvent;

  if (event.type === 'inheritance' || event.type === 'lump_sum' || event.type === 'custom') {
    const legacyAmount = event.cashAmount ?? event.amount ?? 0;
    event.type = legacyAmount >= 0 ? 'cash_windfall' : 'one_time_expense';
    event.cashAmount = Math.abs(legacyAmount);
  }

  if (event.type === 'salary_change') {
    event.salaryChangeMode = event.salaryChangeMode ?? 'set';
    event.annualSalary = event.annualSalary ?? event.amount ?? 0;
    event.isPartner = event.isPartner ?? false;
  }

  if (event.type === 'career_break') {
    event.durationMonths = event.durationMonths ?? 12;
    event.incomeReplacementRate = event.incomeReplacementRate ?? 0;
    event.monthlyExpenseChange = event.monthlyExpenseChange ?? 0;
    event.isPartner = event.isPartner ?? false;
  }

  if (event.type === 'child_born') {
    event.childName = event.childName ?? event.label ?? 'Child';
    event.childMonthlyExpense = event.childMonthlyExpense ?? event.amount ?? 500;
    event.childCareArrangements = (event.childCareArrangements ?? []).map(normalizeChildcareArrangement);
  }

  if (event.type === 'partner_change') {
    event.partnerActive = event.partnerActive ?? ((event.amount ?? 0) > 0);
    event.monthlyExpenseChange = event.monthlyExpenseChange ?? 0;
  }

  if (event.type === 'cash_windfall' || event.type === 'one_time_expense') {
    event.cashAmount = event.cashAmount ?? Math.abs(event.amount ?? 0);
  }

  if (event.type === 'buy_property') {
    event.propertyId = event.propertyId ?? `event-property-${event.id}`;
    event.propertyLabel = event.propertyLabel ?? event.label ?? 'Property purchase';
    event.propertyValue = event.propertyValue ?? Math.abs(event.amount ?? 0);
    event.propertyWozValue = event.propertyWozValue ?? event.propertyValue ?? 0;
    event.propertyAppreciationRate = event.propertyAppreciationRate ?? 0.03;
    event.propertyOwnerOccupied = event.propertyOwnerOccupied ?? true;
    event.propertyRentalIncome = event.propertyRentalIncome ?? 0;
    event.propertyPurchaseCosts = event.propertyPurchaseCosts ?? 0;
    event.propertyMortgages = (event.propertyMortgages ?? []).map(normalizeMortgageConfig);
  }

  if (event.type === 'sell_property') {
    event.salePrice = event.salePrice ?? Math.abs(event.amount ?? 0);
    event.sellingCosts = event.sellingCosts ?? 0;
  }

  return event as LifeEvent;
}

export function normalizeLifeEvents(events: LifeEvent[] | undefined): LifeEvent[] {
  return (events ?? []).map(normalizeLifeEvent);
}

export function createDefaultLifeEvent(type: LifeEventType = 'cash_windfall'): LifeEvent {
  const base: LifeEvent = {
    id: uuidv4(),
    type,
    date: '',
    label: '',
    description: '',
  };

  switch (type) {
    case 'salary_change':
      return {
        ...base,
        label: 'Salary change',
        salaryChangeMode: 'set',
        annualSalary: 0,
        isPartner: false,
      };
    case 'career_break':
      return {
        ...base,
        label: 'Career break',
        durationMonths: 12,
        incomeReplacementRate: 0,
        monthlyExpenseChange: 0,
        isPartner: false,
      };
    case 'child_born':
      return {
        ...base,
        label: 'Child born',
        childName: '',
        childMonthlyExpense: 500,
        childCareArrangements: [],
      };
    case 'partner_change':
      return {
        ...base,
        label: 'Partner change',
        partnerActive: true,
        monthlyExpenseChange: 0,
      };
    case 'cash_windfall':
      return {
        ...base,
        label: 'Cash windfall',
        cashAmount: 0,
      };
    case 'one_time_expense':
      return {
        ...base,
        label: 'One-time expense',
        cashAmount: 0,
      };
    case 'buy_property': {
      const mortgage: MortgageConfig = {
        id: uuidv4(),
        label: 'Mortgage',
        type: 'annuity',
        principal: 0,
        interestRate: 0.04,
        fixedRatePeriod: 10,
        variableRateAfter: 0.05,
        termYears: 30,
        startDate: '',
        deductibilityStartDate: '',
        extraRepayments: [],
        nhg: false,
      };
      return {
        ...base,
        label: 'Buy property',
        propertyId: `event-property-${base.id}`,
        propertyLabel: 'New property',
        propertyValue: 0,
        propertyWozValue: 0,
        propertyAppreciationRate: 0.03,
        propertyOwnerOccupied: true,
        propertyRentalIncome: 0,
        propertyPurchaseCosts: 0,
        propertyMortgages: [mortgage],
      };
    }
    case 'sell_property':
      return {
        ...base,
        label: 'Sell property',
        propertyId: '',
        salePrice: 0,
        sellingCosts: 0,
      };
    default:
      return base;
  }
}

export function getLifeEventPropertyFromPurchase(event: LifeEvent): Property | null {
  if (event.type !== 'buy_property' || !event.propertyId) return null;

  return {
    id: event.propertyId,
    label: event.propertyLabel || event.label || 'Property',
    startDate: event.date ? `${event.date}-01` : '',
    endDate: undefined,
    value: event.propertyValue ?? 0,
    appreciationRate: event.propertyAppreciationRate ?? 0.03,
    mortgages: (event.propertyMortgages ?? []).map(normalizeMortgageConfig),
    wozValue: event.propertyWozValue ?? event.propertyValue ?? 0,
    isOwnerOccupied: event.propertyOwnerOccupied ?? true,
    rentalIncome: event.propertyRentalIncome ?? 0,
    purchaseCosts: event.propertyPurchaseCosts ?? 0,
    sellingCosts: 0,
    salePrice: undefined,
  };
}

function toMonthStart(date: string | undefined): string {
  return date ? `${date}-01` : '';
}

export function migrateModuleOwnedLifeEvents(params: {
  lifeEvents: LifeEvent[] | undefined;
  income: IncomeConfig;
  expenses: ExpenseConfig;
  housing: HousingConfig;
}): {
  lifeEvents: LifeEvent[];
  income: IncomeConfig;
  expenses: ExpenseConfig;
  housing: HousingConfig;
} {
  const normalizedEvents = normalizeLifeEvents(params.lifeEvents);
  const remainingEvents: LifeEvent[] = [];
  const careerEvents = new Map<string, CareerEvent>((params.income.careerEvents ?? []).map((event) => [event.id, event]));
  const children = new Map<string, ChildConfig>(params.expenses.children.map((child) => [child.id, child]));
  const properties = new Map<string, Property>(params.housing.properties.map((property) => [property.id, property]));

  for (const event of normalizedEvents) {
    switch (event.type) {
      case 'salary_change': {
        careerEvents.set(event.id, {
          id: event.id,
          date: event.date,
          label: event.label || 'Salary change',
          isPartner: event.isPartner ?? false,
          type: 'salary_change',
          salaryChangeMode: event.salaryChangeMode ?? 'set',
          newGrossSalary: event.salaryChangeMode === 'delta' ? undefined : (event.annualSalary ?? 0),
          annualSalaryDelta: event.salaryChangeMode === 'delta'
            ? (event.annualSalaryDelta ?? event.annualSalary ?? 0)
            : undefined,
          monthlyExpenseChange: 0,
        });
        break;
      }
      case 'career_break': {
        careerEvents.set(event.id, {
          id: event.id,
          date: event.date,
          label: event.label || 'Career break',
          isPartner: event.isPartner ?? false,
          type: 'career_break',
          durationMonths: event.durationMonths ?? 12,
          incomeReplacementRate: event.incomeReplacementRate ?? 0,
          monthlyExpenseChange: event.monthlyExpenseChange ?? 0,
        });
        break;
      }
      case 'child_born': {
        const childId = `life-event-child-${event.id}`;
        children.set(childId, {
          id: childId,
          name: event.childName ?? event.label ?? 'Child',
          birthDate: toMonthStart(event.date),
          monthlyExpense: event.childMonthlyExpense ?? 500,
          childcareArrangements: (event.childCareArrangements ?? []).map(normalizeChildcareArrangement),
          kinderopvangType: 'none',
          kinderopvangHoursPerMonth: 0,
          kinderopvangHourlyRate: 0,
          kinderopvangStartDate: undefined,
          kinderopvangEndDate: undefined,
        });
        break;
      }
      case 'buy_property': {
        const property = getLifeEventPropertyFromPurchase(event);
        if (!property) {
          remainingEvents.push(event);
          break;
        }

        const existing = properties.get(property.id);
        properties.set(property.id, {
          ...existing,
          ...property,
          startDate: toMonthStart(event.date),
          endDate: existing?.endDate,
          purchaseCosts: event.propertyPurchaseCosts ?? existing?.purchaseCosts ?? 0,
          sellingCosts: existing?.sellingCosts ?? 0,
          salePrice: existing?.salePrice,
        });
        break;
      }
      case 'sell_property': {
        if (!event.propertyId) {
          remainingEvents.push(event);
          break;
        }

        const existing = properties.get(event.propertyId);
        if (!existing) {
          remainingEvents.push(event);
          break;
        }

        properties.set(existing.id, {
          ...existing,
          endDate: toMonthStart(event.date),
          sellingCosts: event.sellingCosts ?? existing.sellingCosts ?? 0,
          salePrice: event.salePrice ?? existing.salePrice,
        });
        break;
      }
      default:
        remainingEvents.push(event);
    }
  }

  return {
    lifeEvents: remainingEvents,
    income: {
      ...params.income,
      careerEvents: [...careerEvents.values()],
    },
    expenses: {
      ...params.expenses,
      children: [...children.values()],
    },
    housing: {
      ...params.housing,
      properties: [...properties.values()],
    },
  };
}
