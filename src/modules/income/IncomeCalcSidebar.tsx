import { useActiveScenario } from '@/store';
import { useSimulation } from '@/hooks/useSimulation';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur, pct } from '@/components/common/CalculationPanel';

export function IncomeCalcSidebar() {
  const scenario = useActiveScenario();
  const sim = useSimulation();
  const inc = scenario.income;
  const housing = scenario.housing;

  const holidayPay = inc.grossSalary * inc.holidayAllowance;
  // Match engine: use custom thirteenthMonthAmount if > 0, otherwise salary/12
  const thirteenthMonth = inc.thirteenthMonth
    ? (inc.thirteenthMonthAmount > 0 ? inc.thirteenthMonthAmount : inc.grossSalary / 12)
    : 0;
  const annualGross = inc.grossSalary + holidayPay + thirteenthMonth + inc.bonusAmount;

  const sideIncomeAnnual = inc.sideIncomes.reduce((sum, si) => {
    const mult = si.frequency === 'monthly' ? 12 : si.frequency === 'quarterly' ? 4 : 1;
    return sum + si.grossAmount * mult;
  }, 0);

  const partnerHolidayPay = inc.partnerGrossSalary * inc.partnerHolidayAllowance;
  // Match engine: partner 13th month uses partnerSalary/12/12 (prorated monthly)
  const partnerThirteenthMonth = inc.partnerThirteenthMonth ? inc.partnerGrossSalary / 12 : 0;
  const partnerAnnualGross = inc.hasPartner
    ? inc.partnerGrossSalary + partnerHolidayPay + partnerThirteenthMonth + (inc.partnerBonusAmount ?? 0)
    : 0;

  // Rental income from non-owner-occupied properties (attributed to primary in engine)
  const annualRentalIncome = housing.properties
    .filter((p) => !p.isOwnerOccupied && p.rentalIncome > 0)
    .reduce((sum, p) => sum + p.rentalIncome * 12, 0);

  const totalHouseholdGross = annualGross + sideIncomeAnnual + partnerAnnualGross + annualRentalIncome;

  const currentYear = new Date().getFullYear();
  const yearSummary = sim.annualSummaries.find((s) => s.year === currentYear);

  return (
    <div className="space-y-3">
      <CalculationPanel title="Gross Income Breakdown">
        <CalcSection title="Primary">
          <CalcLine label="Base salary" value={cur(inc.grossSalary)} />
          <CalcLine label={`Holiday allowance (${pct(inc.holidayAllowance)})`} value={`+ ${cur(holidayPay)}`} indent={1} />
          {inc.thirteenthMonth && (
            <CalcLine label="13th month" value={`+ ${cur(thirteenthMonth)}`} indent={1} />
          )}
          {inc.bonusAmount > 0 && (
            <CalcLine label="Annual bonus" value={`+ ${cur(inc.bonusAmount)}`} indent={1} />
          )}
          <CalcSeparator />
          <CalcLine label="Your annual gross" value={cur(annualGross)} bold />
        </CalcSection>

        {sideIncomeAnnual > 0 && (
          <CalcSection title="Side Income">
            {inc.sideIncomes.map((si) => {
              const mult = si.frequency === 'monthly' ? 12 : si.frequency === 'quarterly' ? 4 : 1;
              return (
                <CalcLine key={si.id} label={si.label || 'Unnamed'} value={`+ ${cur(si.grossAmount * mult)}/yr`} />
              );
            })}
            <CalcSeparator />
            <CalcLine label="Total side income" value={cur(sideIncomeAnnual)} bold />
          </CalcSection>
        )}

        {inc.hasPartner && (
          <CalcSection title="Partner">
            <CalcLine label="Partner salary" value={cur(inc.partnerGrossSalary)} />
            <CalcLine label={`Holiday allow. (${pct(inc.partnerHolidayAllowance)})`} value={`+ ${cur(partnerHolidayPay)}`} indent={1} />
            {inc.partnerThirteenthMonth && (
              <CalcLine label="13th month" value={`+ ${cur(partnerThirteenthMonth)}`} indent={1} />
            )}
            {(inc.partnerBonusAmount ?? 0) > 0 && (
              <CalcLine label="Annual bonus" value={`+ ${cur(inc.partnerBonusAmount)}`} indent={1} />
            )}
            <CalcSeparator />
            <CalcLine label="Partner annual gross" value={cur(partnerAnnualGross)} bold />
          </CalcSection>
        )}

        {annualRentalIncome > 0 && (
          <CalcSection title="Rental Income">
            {housing.properties
              .filter((p) => !p.isOwnerOccupied && p.rentalIncome > 0)
              .map((p) => (
                <CalcLine key={p.id} label={p.label || 'Property'} value={`+ ${cur(p.rentalIncome * 12)}/yr`} />
              ))}
            <CalcSeparator />
            <CalcLine label="Total rental income" value={cur(annualRentalIncome)} bold />
          </CalcSection>
        )}

        <CalcSection>
          <CalcSeparator />
          <CalcLine label="TOTAL HOUSEHOLD GROSS" value={cur(totalHouseholdGross)} bold accent />
          <CalcLine label="Monthly" value={cur(totalHouseholdGross / 12)} dimmed />
        </CalcSection>
      </CalculationPanel>

      {yearSummary && (
        <CalculationPanel title={`${currentYear} Projection`}>
          <CalcSection>
            <CalcLine label="Gross income" value={cur(yearSummary.grossIncome)} />
            <CalcLine label="Tax (Box 1)" value={`- ${cur(yearSummary.taxBox1)}`} />
            <CalcLine label="Tax credits" value={`+ ${cur(yearSummary.taxCredits)}`} />
            {yearSummary.taxBox3 > 0 && <CalcLine label="Tax (Box 3)" value={`- ${cur(yearSummary.taxBox3)}`} />}
            <CalcSeparator />
            <CalcLine label="Net income" value={cur(yearSummary.netIncome)} bold />
            <CalcLine label="Effective rate" value={pct(yearSummary.effectiveTaxRate)} dimmed />
          </CalcSection>

          {yearSummary.primaryTax && yearSummary.partnerTax && (
            <CalcSection title="Per Partner">
              <CalcLine label="Your net" value={cur(yearSummary.primaryTax.netIncome)} />
              <CalcLine label="Your eff. rate" value={pct(yearSummary.primaryTax.effectiveRate)} dimmed indent={1} />
              <CalcLine label="Partner net" value={cur(yearSummary.partnerTax.netIncome)} />
              <CalcLine label="Partner eff. rate" value={pct(yearSummary.partnerTax.effectiveRate)} dimmed indent={1} />
            </CalcSection>
          )}

          <CalcNote>
            Projected based on merit increase of {pct(inc.meritIncreaseRate)}/yr applied to current salary.
          </CalcNote>
        </CalculationPanel>
      )}

      {inc.careerEvents.length > 0 && (
        <CalculationPanel title="Career Timeline">
          <CalcSection>
            <CalcLine label="Now" value={cur(inc.grossSalary)} />
            {inc.careerEvents
              .filter((ce) => ce.date)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((ce) => (
                <CalcLine key={ce.id} label={ce.label || ce.date} value={`→ ${cur(ce.newGrossSalary)}`} />
              ))}
          </CalcSection>
        </CalculationPanel>
      )}
    </div>
  );
}
