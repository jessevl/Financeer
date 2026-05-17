import { v4 as uuidv4 } from 'uuid';
import type { ChildConfig, ChildcareArrangement } from '@/types';

export function getChildAgeYears(child: Pick<ChildConfig, 'birthDate'>, currentDate: Date): number {
  if (!child.birthDate) return 0;
  return (currentDate.getTime() - new Date(child.birthDate).getTime()) / (365.25 * 24 * 3600000);
}

export function getChildcareArrangements(child: ChildConfig): ChildcareArrangement[] {
  if (child.childcareArrangements && child.childcareArrangements.length > 0) {
    return child.childcareArrangements;
  }

  if (!child.kinderopvangType || child.kinderopvangType === 'none') {
    return [];
  }

  return [
    {
      id: `${child.id}-legacy-childcare`,
      type: child.kinderopvangType,
      hoursPerMonth: child.kinderopvangHoursPerMonth ?? 0,
      hourlyRate: child.kinderopvangHourlyRate ?? 0,
      startDate: child.kinderopvangStartDate,
      endDate: child.kinderopvangEndDate,
    },
  ];
}

export function normalizeChildcareArrangements(child: ChildConfig | Record<string, unknown>): ChildcareArrangement[] {
  const typedChild = child as ChildConfig;
  const arrangements = Array.isArray(typedChild.childcareArrangements)
    ? typedChild.childcareArrangements
    : getChildcareArrangements(typedChild);

  return arrangements
    .filter((arrangement) => arrangement && arrangement.type)
    .map((arrangement) => ({
      id: arrangement.id ?? uuidv4(),
      type: arrangement.type,
      hoursPerMonth: arrangement.hoursPerMonth ?? 0,
      hourlyRate: arrangement.hourlyRate ?? 0,
      startDate: arrangement.startDate,
      endDate: arrangement.endDate,
    }));
}

export function isChildcareArrangementEligible(
  arrangement: ChildcareArrangement,
  child: Pick<ChildConfig, 'birthDate'>,
  currentDate: Date,
): boolean {
  const age = getChildAgeYears(child, currentDate);

  if (arrangement.type === 'bso') {
    if (!(age >= 4 && age < 13)) return false;
  } else if (!(age >= 0 && age < 13)) {
    return false;
  }

  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  if (arrangement.startDate && monthKey < arrangement.startDate) return false;
  if (arrangement.endDate && monthKey > arrangement.endDate) return false;
  return true;
}

export function getChildcareTypeLabel(type: ChildcareArrangement['type']): string {
  if (type === 'daycare') return 'Kinderdagverblijf';
  if (type === 'bso') return 'BSO';
  return 'Gastouder';
}