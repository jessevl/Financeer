import { useActiveScenario } from '@/store';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur, pct, num } from '@/components/common/CalculationPanel';
import { compareRentalBox3vsBV, calculateEigenwoningforfait } from '@/engine/tax';
import type { MortgageConfig } from '@/types';

function estimatePayment(m: MortgageConfig): number {
  if (m.principal <= 0 || m.termYears <= 0) return 0;
  const effectiveRate = m.nhg ? Math.max(0, m.interestRate - 0.006) : m.interestRate;
  const r = effectiveRate / 12;
  const n = m.termYears * 12;
  if (m.type === 'interest-only') return m.principal * r;
  if (m.type === 'linear') return m.principal / n + m.principal * r;
  if (r === 0) return m.principal / n;
  return m.principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function totalInterest(m: MortgageConfig): number {
  const monthly = estimatePayment(m);
  if (m.type === 'interest-only') return m.principal * m.interestRate * m.termYears;
  if (m.type === 'linear') {
    // Total interest for linear: sum of declining balance × rate
    const n = m.termYears * 12;
    const monthlyPrincipal = m.principal / n;
    let total = 0;
    let balance = m.principal;
    for (let i = 0; i < n; i++) {
      total += balance * (m.interestRate / 12);
      balance -= monthlyPrincipal;
    }
    return total;
  }
  // Annuity: total payments minus principal
  return monthly * m.termYears * 12 - m.principal;
}

export function HousingCalcSidebar() {
  const scenario = useActiveScenario();
  const { housing, tax } = scenario;

  const ownerOccupied = housing.properties.find((p) => p.isOwnerOccupied);
  const totalPropertyValue = housing.properties.reduce((s, p) => s + p.value, 0);
  const totalMortgageBalance = housing.properties.reduce(
    (s, p) => s + p.mortgages.reduce((ms, m) => ms + m.principal, 0), 0
  );
  const totalEquity = totalPropertyValue - totalMortgageBalance;

  // EWF calculation — use engine function for consistency (handles threshold + 2.35% excess)
  const wozValue = ownerOccupied?.wozValue ?? 0;
  const ewf = ownerOccupied ? calculateEigenwoningforfait(wozValue, tax) : 0;
  const ewfRate = wozValue > 0 ? ewf / wozValue : tax.eigenwoningforfaitRate;

  return (
    <div className="space-y-3">
      {housing.properties.map((property) => (
        <CalculationPanel key={property.id} title={property.label || 'Property'}>
          <CalcSection title="Property Value">
            <CalcLine label="Current value" value={cur(property.value)} />
            <CalcLine label="Appreciation" value={pct(property.appreciationRate)} />
            <CalcLine label="In 10 years" value={cur(property.value * Math.pow(1 + property.appreciationRate, 10))} dimmed />
            <CalcLine label="In 30 years" value={cur(property.value * Math.pow(1 + property.appreciationRate, 30))} dimmed />
          </CalcSection>

          {property.mortgages.map((m) => {
            const payment = estimatePayment(m);
            const interest = totalInterest(m);
            const firstMonthInterest = m.principal * (m.interestRate / 12);
            const firstMonthPrincipal = m.type === 'interest-only' ? 0 :
              m.type === 'linear' ? m.principal / (m.termYears * 12) :
              payment - firstMonthInterest;

            return (
              <CalcSection key={m.id} title={m.label || 'Mortgage'}>
                <CalcLine label="Principal" value={cur(m.principal)} />
                <CalcLine label="Interest rate" value={pct(m.interestRate)} />
                <CalcLine label="Term" value={`${m.termYears} yr`} />
                <CalcLine label="Type" value={m.type} />
                <CalcSeparator />
                <CalcLine label="Monthly payment" value={cur(payment)} bold />
                <CalcLine label="  Interest" value={cur(firstMonthInterest)} indent={1} dimmed />
                <CalcLine label="  Principal" value={cur(firstMonthPrincipal)} indent={1} dimmed />
                <CalcSeparator />
                <CalcLine label="Total interest paid" value={cur(interest)} />
                <CalcLine label="Total cost" value={cur(m.principal + interest)} />
                <CalcLine label="Annual interest" value={cur(m.principal * m.interestRate)} dimmed />

                {m.fixedRatePeriod > 0 && m.variableRateAfter > 0 && (
                  <>
                    <CalcSeparator />
                    <CalcLine label={`Fixed rate: ${num(m.fixedRatePeriod, 0)} yr`} value={pct(m.interestRate)} dimmed />
                    <CalcLine label={`After fixed period`} value={pct(m.variableRateAfter)} dimmed />
                  </>
                )}
              </CalcSection>
            );
          })}
        </CalculationPanel>
      ))}

      {ownerOccupied && (
        <CalculationPanel title="Eigenwoningforfait">
          <CalcSection>
            <CalcLine label="WOZ value" value={cur(wozValue)} />
            <CalcLine label={`Effective rate`} value={pct(ewfRate)} />
            {wozValue > tax.eigenwoningforfaitThreshold && (
              <CalcLine label={`Includes 2.35% above ${cur(tax.eigenwoningforfaitThreshold)}`} value="" dimmed indent={1} />
            )}
            <CalcSeparator />
            <CalcLine label="EWF (added to income)" value={cur(ewf)} bold />
            <CalcLine label="Year-1 mortgage interest" value={cur(ownerOccupied.mortgages.reduce((s, m) => s + m.principal * m.interestRate, 0))} dimmed />
          </CalcSection>
          <CalcNote>
            Mortgage interest declines as you amortise. See the Tax module for the actual deduction used in the simulation.
          </CalcNote>
        </CalculationPanel>
      )}

      <CalculationPanel title="Portfolio Summary">
        <CalcSection>
          <CalcLine label="Total property value" value={cur(totalPropertyValue)} />
          <CalcLine label="Total mortgages" value={`- ${cur(totalMortgageBalance)}`} />
          <CalcSeparator />
          <CalcLine label="Home equity" value={cur(totalEquity)} bold accent />
          <CalcLine label="LTV ratio" value={totalPropertyValue > 0 ? pct(totalMortgageBalance / totalPropertyValue) : '—'} dimmed />
        </CalcSection>
        <CalcNote>
          Home equity is NOT counted toward FIRE wealth. Only liquid assets (cash + investments) count.
        </CalcNote>
      </CalculationPanel>

      {/* Rental Property: Box 3 vs BV comparison */}
      {housing.properties
        .filter((p) => !p.isOwnerOccupied && p.rentalIncome > 0)
        .map((prop) => {
          const annualRental = prop.rentalIncome * 12;
          const propMortgageDebt = prop.mortgages.reduce((s, m) => s + m.principal, 0);
          const annualMortgageInterest = prop.mortgages.reduce((s, m) => s + m.principal * m.interestRate, 0);
          // Estimate annual expenses as ~1% of property value (maintenance, insurance, etc.)
          const annualExpenses = prop.value * 0.01;
          const isCouple = tax.filingType === 'couple';

          const comparison = compareRentalBox3vsBV(
            prop.value, annualRental, annualExpenses, propMortgageDebt, annualMortgageInterest, tax, isCouple,
          );

          return (
            <CalculationPanel key={`bv-${prop.id}`} title={`${prop.label}: Box 3 vs BV`}>
              <CalcSection title="Box 3 (Private)">
                <CalcLine label="Fictional return tax" value={cur(comparison.box3.annualTax)} />
                <CalcLine label="Effective rate" value={pct(comparison.box3.effectiveRate)} dimmed />
                <CalcLine label="Net rental income" value={cur(comparison.box3.netIncome)} bold />
              </CalcSection>

              <CalcSection title="BV (Corporate)">
                <CalcLine label="VPB (corporate tax)" value={cur(comparison.bv.vpbTax)} />
                <CalcLine label="Profit after VPB" value={cur(comparison.bv.netProfit)} dimmed />
                <CalcLine label="Box 2 (dividend tax)" value={cur(comparison.bv.box2Tax)} />
                <CalcSeparator />
                <CalcLine label="Total BV tax" value={cur(comparison.bv.totalTax)} />
                <CalcLine label="Effective rate" value={pct(comparison.bv.effectiveRate)} dimmed />
                <CalcLine label="Net rental income" value={cur(comparison.bv.netIncome)} bold />
              </CalcSection>

              <CalcSection title="Conclusion">
                <CalcLine
                  label="Better option"
                  value={comparison.advantage === 'bv' ? 'BV' : comparison.advantage === 'box3' ? 'Box 3' : 'Similar'}
                  bold
                  accent
                />
                {comparison.difference !== 0 && (
                  <CalcLine
                    label={comparison.difference > 0 ? 'BV saves you' : 'Box 3 saves you'}
                    value={cur(Math.abs(comparison.difference))}
                  />
                )}
              </CalcSection>
              <CalcNote>
                Comparison assumes full profit distribution as dividend. BV setup/admin costs not included.
                Actual expenses estimated at 1% of property value.
              </CalcNote>
            </CalculationPanel>
          );
        })}
    </div>
  );
}
