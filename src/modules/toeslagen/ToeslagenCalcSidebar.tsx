import { useActiveScenario } from '@/store';
import { useSimulation } from '@/hooks/useSimulation';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur, pct } from '@/components/common/CalculationPanel';
import { calculateAnnualToeslagen } from '@/engine/toeslagen';

export function ToeslagenCalcSidebar() {
  const scenario = useActiveScenario();
  const sim = useSimulation();
  const { toeslagen, expenses, income, tax } = scenario;

  const currentYear = new Date().getFullYear();
  const yearSummary = sim.annualSummaries.find((s) => s.year === currentYear);
  const grossIncome = yearSummary?.grossIncome ?? 0;
  const wealth = (yearSummary?.endCashBalance ?? 0) + (yearSummary?.endInvestmentValue ?? 0);
  const isCouple = tax.filingType === 'couple';
  const isSingleParent = !income.hasPartner;

  const allChildren = [...expenses.children];
  const breakdown = calculateAnnualToeslagen(
    grossIncome,
    wealth,
    allChildren,
    new Date(),
    isCouple,
    isSingleParent,
    toeslagen,
  );

  if (!toeslagen.enabled) {
    return (
      <CalculationPanel title="Toeslagen Disabled">
        <CalcNote>
          Enable toeslagen in the settings to see benefit calculations.
        </CalcNote>
      </CalculationPanel>
    );
  }

  // Zorgtoeslag calculation detail — match engine formula exactly
  const zt = toeslagen.zorgtoeslag;
  const wealthLimitZT = isCouple ? zt.vermogensGrensCouple : zt.vermogensGrensSingle;
  const ztThresholdPct = isCouple ? zt.drempelPercentageCouple : zt.drempelPercentageSingle;
  const ztIncomeAboveThreshold = Math.max(0, grossIncome - zt.drempelinkomen);
  // Engine formula: normpremie = drempelRate * drempelinkomen + excessRate * excess
  const ztNormpremie = ztThresholdPct * zt.drempelinkomen + zt.excessPercentage * ztIncomeAboveThreshold;
  const ztPremie = isCouple ? 2 * zt.standaardpremie : zt.standaardpremie;

  // Kindgebonden budget detail — match engine formula exactly
  const kb = toeslagen.kindgebondenBudget;
  const numChildren = allChildren.filter((c) => {
    if (!c.birthDate) return false;
    const age = (new Date().getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 3600000);
    return age < 18;
  }).length;
  const kbBase = kb.basePerChild * numChildren;
  const kbSingleExtra = isSingleParent ? kb.singleParentExtra : 0;
  // Engine: threshold = drempelinkomen + (couple ? coupleExtraThreshold : 0)
  const kbThreshold = isCouple ? kb.drempelinkomen + kb.coupleExtraThreshold : kb.drempelinkomen;
  const kbExcess = Math.max(0, grossIncome - kbThreshold);
  const kbReduction = kbExcess * kb.reductionRate;

  // Kinderbijslag detail
  const kbij = toeslagen.kinderbijslag;
  const now = new Date();
  const childAges = allChildren.map((c) => {
    if (!c.birthDate) return -1;
    return Math.floor((now.getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 3600000));
  }).filter((a) => a >= 0 && a < 18);

  return (
    <div className="space-y-3">
      {zt.enabled && (
        <CalculationPanel title="Zorgtoeslag">
          <CalcSection title="Calculation">
            <CalcLine label={isCouple ? 'Standard premium (2×)' : 'Standard premium'} value={cur(ztPremie)} />
            <CalcLine label="Gross income" value={cur(grossIncome)} />
            <CalcLine label="Drempelinkomen" value={cur(zt.drempelinkomen)} />
            <CalcLine label={`Normpremie (${pct(ztThresholdPct)} base + ${pct(zt.excessPercentage)} excess)`} value={`- ${cur(ztNormpremie)}`} />
            <CalcLine label="Wealth" value={cur(wealth)} />
            <CalcLine label="Wealth limit" value={cur(wealthLimitZT)} dimmed />
            <CalcSeparator />
            <CalcLine label="Zorgtoeslag" value={cur(breakdown.zorgtoeslag)} bold accent />
            <CalcLine label="Monthly" value={cur(breakdown.zorgtoeslag / 12)} dimmed />
          </CalcSection>
          <CalcNote>
            {wealth > wealthLimitZT
              ? `Wealth (${cur(wealth)}) exceeds limit (${cur(wealthLimitZT)}) — no zorgtoeslag.`
              : `Income-dependent: higher income = less zorgtoeslag.`}
          </CalcNote>
        </CalculationPanel>
      )}

      {kb.enabled && numChildren > 0 && (
        <CalculationPanel title="Kindgebonden Budget">
          <CalcSection title="Base Amount">
            <CalcLine label={`${numChildren} child(ren) × ${cur(kb.basePerChild)}`} value={cur(kbBase)} />
            {isSingleParent && <CalcLine label="Single parent extra" value={`+ ${cur(kbSingleExtra)}`} />}
            <CalcLine label="Gross entitlement" value={cur(kbBase + kbSingleExtra)} bold />
          </CalcSection>

          <CalcSection title="Income Reduction">
            <CalcLine label="Income" value={cur(grossIncome)} />
            <CalcLine label={isCouple ? `Threshold (incl. couple)` : 'Threshold'} value={`- ${cur(kbThreshold)}`} />
            <CalcLine label="Excess income" value={cur(kbExcess)} indent={1} />
            <CalcLine label={`× reduction rate ${pct(kb.reductionRate)}`} value={`- ${cur(kbReduction)}`} />
            <CalcSeparator />
            <CalcLine label="Kindgebonden budget" value={cur(breakdown.kindgebondenBudget)} bold accent />
            <CalcLine label="Monthly" value={cur(breakdown.kindgebondenBudget / 12)} dimmed />
          </CalcSection>

          {allChildren.some((c) => {
            if (!c.birthDate) return false;
            const age = (now.getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 3600000);
            return age >= 12 && age < 18;
          }) && (
            <CalcNote>
              Children 12–15: +{cur(kb.supplement12to15)}/yr, 16–17: +{cur(kb.supplement16to17)}/yr supplements included automatically.
            </CalcNote>
          )}
        </CalculationPanel>
      )}

      {kbij.enabled && childAges.length > 0 && (
        <CalculationPanel title="Kinderbijslag">
          <CalcSection title="Quarterly by Age">
            {childAges.map((age, i) => {
              const quarterly = age <= 5 ? kbij.quarterly0to5 : age <= 11 ? kbij.quarterly6to11 : kbij.quarterly12to17;
              const bracket = age <= 5 ? '0–5' : age <= 11 ? '6–11' : '12–17';
              return (
                <CalcLine key={i} label={`Child (age ${age}) [${bracket}]`} value={`${cur(quarterly)}/qtr`} />
              );
            })}
            <CalcSeparator />
            <CalcLine label="Annual kinderbijslag" value={cur(breakdown.kinderbijslag)} bold accent />
            <CalcLine label="Monthly" value={cur(breakdown.kinderbijslag / 12)} dimmed />
          </CalcSection>
          <CalcNote>
            Kinderbijslag is universal — not income-dependent. Paid quarterly per child under 18.
          </CalcNote>
        </CalculationPanel>
      )}

      {breakdown.kinderopvangtoeslag > 0 && (
        <CalculationPanel title="Kinderopvangtoeslag">
          <CalcSection title="Childcare Benefit">
            {allChildren
              .filter((c) => {
                const koType = (c as any).kinderopvangType ?? 'none';
                if (koType === 'none') return false;
                if (!c.birthDate) return false;
                const age = (now.getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 3600000);
                if (koType === 'bso') return age >= 4 && age < 13;
                return age >= 0 && age < 13;
              })
              .map((c, i) => {
                const koType = (c as any).kinderopvangType as string;
                const koHours = (c as any).kinderopvangHoursPerMonth ?? 0;
                const koRate = (c as any).kinderopvangHourlyRate ?? 0;
                const kt = toeslagen.kinderopvangtoeslag;
                const maxRate = koType === 'daycare' ? kt.maxHourlyRateDaycare
                  : koType === 'bso' ? kt.maxHourlyRateBso : kt.maxHourlyRateGastouder;
                const effectiveRate = Math.min(koRate, maxRate);
                const cappedHours = Math.min(koHours, kt.maxHoursPerMonth);
                const label = koType === 'daycare' ? 'Dagopvang' : koType === 'bso' ? 'BSO' : 'Gastouder';
                return (
                  <div key={i} className="mb-2">
                    <CalcLine label={`${c.name || 'Child'} — ${label}`} value="" />
                    <CalcLine label={`Hours: ${cappedHours}/mo (max ${kt.maxHoursPerMonth})`} value="" indent={1} dimmed />
                    <CalcLine label={`Rate: ${cur(effectiveRate)} (max ${cur(maxRate)})`} value="" indent={1} dimmed />
                    <CalcLine label={`Gross cost`} value={cur(cappedHours * effectiveRate)} indent={1} dimmed />
                  </div>
                );
              })}
            <CalcSeparator />
            <CalcLine label="Kinderopvangtoeslag" value={cur(breakdown.kinderopvangtoeslag)} bold accent />
            <CalcLine label="Monthly" value={cur(breakdown.kinderopvangtoeslag / 12)} dimmed />
          </CalcSection>
          <CalcNote>
            Income-dependent: reimbursement rate decreases with higher income. Different max hourly rates apply per type.
          </CalcNote>
        </CalculationPanel>
      )}

      {breakdown.huurtoeslag > 0 && (
        <CalculationPanel title="Huurtoeslag">
          <CalcSection title="Rent Allowance">
            <CalcLine label="Monthly rent" value={cur(toeslagen.huurtoeslag.monthlyRent)} />
            <CalcLine label="Basishuur" value={`- ${cur(toeslagen.huurtoeslag.basishuur)}`} />
            <CalcLine label="Aftoppingsgrens" value={cur(toeslagen.huurtoeslag.aftoppingsgrens)} dimmed />
            <CalcLine label="Max huur" value={cur(toeslagen.huurtoeslag.maxHuur)} dimmed />
            <CalcSeparator />
            <CalcLine label="Gross income" value={cur(grossIncome)} />
            <CalcLine label={`Max income (${isCouple ? 'couple' : 'single'})`} value={cur(isCouple ? toeslagen.huurtoeslag.maxInkomenCouple : toeslagen.huurtoeslag.maxInkomenSingle)} dimmed />
            <CalcSeparator />
            <CalcLine label="Annual huurtoeslag" value={cur(breakdown.huurtoeslag)} bold accent />
            <CalcLine label="Monthly" value={cur(breakdown.huurtoeslag / 12)} dimmed />
          </CalcSection>
          <CalcNote>
            Rent must be between basishuur and max huur. Income and wealth limits apply.
          </CalcNote>
        </CalculationPanel>
      )}

      <CalculationPanel title="Total Benefits">
        <CalcSection>
          {zt.enabled && <CalcLine label="Zorgtoeslag" value={cur(breakdown.zorgtoeslag)} />}
          {kb.enabled && <CalcLine label="Kindgebonden budget" value={cur(breakdown.kindgebondenBudget)} />}
          {kbij.enabled && <CalcLine label="Kinderbijslag" value={cur(breakdown.kinderbijslag)} />}
          {breakdown.kinderopvangtoeslag > 0 && <CalcLine label="Kinderopvangtoeslag" value={cur(breakdown.kinderopvangtoeslag)} />}
          {breakdown.huurtoeslag > 0 && <CalcLine label="Huurtoeslag" value={cur(breakdown.huurtoeslag)} />}
          <CalcSeparator />
          <CalcLine label="TOTAL ANNUAL" value={cur(breakdown.total)} bold accent />
          <CalcLine label="Monthly" value={cur(breakdown.total / 12)} dimmed />
        </CalcSection>
        <CalcNote>
          Toeslagen are recalculated annually based on income and household composition. Actual amounts may differ from estimates.
        </CalcNote>
      </CalculationPanel>
    </div>
  );
}
