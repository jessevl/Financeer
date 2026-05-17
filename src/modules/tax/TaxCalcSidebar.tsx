import { useActiveScenario } from '@/store';
import { useSimulation } from '@/hooks/useSimulation';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur, pct } from '@/components/common/CalculationPanel';
import { calculateJaarruimte, calculateGiftenaftrek, optimizeFiscaalPartnerschap } from '@/engine/tax';
import type { PartnerTaxBreakdown, TaxBracket } from '@/types';

function TaxBreakdownPanel({ title, t, brackets }: {
  title: string;
  t: PartnerTaxBreakdown;
  brackets: TaxBracket[];
}) {
  const totalCredits = t.generalCredit + t.labourCredit + t.iackCredit + t.ouderenCredit + t.jonggehandicaptCredit;

  return (
    <CalculationPanel title={`Box 1 — ${title}`}>
      <CalcSection title="Taxable Income">
        <CalcLine label="Gross income" value={cur(t.grossIncome)} />
        {t.lijfrenteDeduction > 0 && <CalcLine label="− Lijfrente deduction" value={`- ${cur(t.lijfrenteDeduction)}`} indent={1} />}
        {t.hillenRelief > 0 && <CalcLine label="− Hillen relief" value={`- ${cur(t.hillenRelief)}`} indent={1} />}
        {t.giftenDeduction > 0 && <CalcLine label="− Giftenaftrek" value={`- ${cur(t.giftenDeduction)}`} indent={1} />}
        {t.alimentatieDeduction > 0 && <CalcLine label="− Alimentatie" value={`- ${cur(t.alimentatieDeduction)}`} indent={1} />}
        {t.selfEmploymentDeduction > 0 && <CalcLine label="− Self-employment ded." value={`- ${cur(t.selfEmploymentDeduction)}`} indent={1} />}
      </CalcSection>

      <CalcSection title="Tax Brackets">
        {brackets.map((b, i) => (
          <CalcLine key={i} label={b.upperLimit ? `Up to ${cur(b.upperLimit)}` : 'Remainder'} value={pct(b.rate)} />
        ))}
        <CalcSeparator />
        <CalcLine label="Gross tax" value={cur(t.incomeTax)} bold />
      </CalcSection>

      <CalcSection title="Tax Credits (−)">
        <CalcLine label="Algemene heffingskorting" value={`- ${cur(t.generalCredit)}`} />
        <CalcLine label="Arbeidskorting" value={`- ${cur(t.labourCredit)}`} />
        {t.iackCredit > 0 && <CalcLine label="IACK" value={`- ${cur(t.iackCredit)}`} />}
        {t.ouderenCredit > 0 && <CalcLine label="Ouderenkorting" value={`- ${cur(t.ouderenCredit)}`} />}
        {t.jonggehandicaptCredit > 0 && <CalcLine label="Jonggehandicaptenkorting" value={`- ${cur(t.jonggehandicaptCredit)}`} />}
        <CalcSeparator />
        <CalcLine label="Total credits" value={cur(totalCredits)} bold />
      </CalcSection>

      <CalcSection title="Result">
        <CalcLine label="Box 1 tax" value={cur(Math.max(0, t.incomeTax - totalCredits))} />
        {t.box2Tax > 0 && <CalcLine label="Box 2 tax" value={`+ ${cur(t.box2Tax)}`} />}
        <CalcLine label="ZVW contribution" value={`+ ${cur(t.zvw)}`} />
        <CalcSeparator />
        <CalcLine label="Total tax" value={cur(t.grossIncome - t.netIncome)} bold accent />
        <CalcLine label="Net income" value={cur(t.netIncome)} bold />
        <CalcLine label="Effective rate" value={pct(t.effectiveRate)} dimmed />
      </CalcSection>
    </CalculationPanel>
  );
}

export function TaxCalcSidebar() {
  const scenario = useActiveScenario();
  const sim = useSimulation();
  const { tax, income } = scenario;

  const currentYear = new Date().getFullYear();
  const yearSummary = sim.annualSummaries.find((s) => s.year === currentYear);

  // Use simulation-computed values (which follow amortising mortgage balances, etc.)
  const grossIncome = yearSummary?.grossIncome ?? 0;
  const mortgageInterest = yearSummary?.mortgageInterestDeduction ?? 0;
  const ewf = yearSummary?.eigenwoningforfait ?? 0;
  const primaryTax = yearSummary?.primaryTax;
  const partnerTax = yearSummary?.partnerTax;
  const hasPartnerTax = !!partnerTax;

  const jaarruimte = calculateJaarruimte(primaryTax?.grossIncome ?? grossIncome, tax);
  const giftenaftrek = calculateGiftenaftrek(primaryTax?.grossIncome ?? grossIncome, tax);
  const opt = tax.taxOptimizations;

  return (
    <div className="space-y-3">
      {/* Housing deduction summary */}
      {(ewf > 0 || mortgageInterest > 0) && (
        <CalculationPanel title="Housing Deduction">
          <CalcSection>
            <CalcLine label="Eigenwoningforfait" value={`+ ${cur(ewf)}`} />
            <CalcLine label="Mortgage interest" value={`- ${cur(mortgageInterest)}`} />
            {primaryTax && primaryTax.hillenRelief > 0 && (
              <CalcLine label="Hillen relief" value={`- ${cur(primaryTax.hillenRelief)}`} />
            )}
            <CalcSeparator />
            <CalcLine label="Net housing impact" value={cur(ewf - mortgageInterest - (primaryTax?.hillenRelief ?? 0))} bold />
          </CalcSection>
          <CalcNote>
            Mortgage interest based on current amortised balance, not original principal.
          </CalcNote>
        </CalculationPanel>
      )}

      {/* Per-partner tax breakdown */}
      {primaryTax && (
        <TaxBreakdownPanel
          title={hasPartnerTax ? 'Primary' : 'Income Tax'}
          t={primaryTax}
          brackets={tax.box1Brackets}
        />
      )}

      {partnerTax && (
        <TaxBreakdownPanel title="Partner" t={partnerTax} brackets={tax.box1Brackets} />
      )}

      {/* Combined household summary (when partner) */}
      {hasPartnerTax && primaryTax && partnerTax && (
        <CalculationPanel title="Household Total">
          <CalcSection>
            <CalcLine label="Your net" value={cur(primaryTax.netIncome)} />
            <CalcLine label="Partner net" value={`+ ${cur(partnerTax.netIncome)}`} />
            <CalcSeparator />
            <CalcLine label="Total household net" value={cur(primaryTax.netIncome + partnerTax.netIncome)} bold accent />
            <CalcLine label="Combined tax" value={cur((primaryTax.grossIncome - primaryTax.netIncome) + (partnerTax.grossIncome - partnerTax.netIncome))} />
            <CalcLine label="Effective rate" value={pct(yearSummary?.effectiveTaxRate ?? 0)} dimmed />
            <CalcLine label="Monthly household net" value={cur((primaryTax.netIncome + partnerTax.netIncome) / 12)} dimmed />
          </CalcSection>
        </CalculationPanel>
      )}

      {/* Single filer monthly net */}
      {!hasPartnerTax && primaryTax && (
        <CalculationPanel title="Summary">
          <CalcSection>
            <CalcLine label="Monthly net income" value={cur(primaryTax.netIncome / 12)} bold />
          </CalcSection>
        </CalculationPanel>
      )}

      {(opt.lijfrenteAnnualContribution > 0 || jaarruimte > 0) && (
        <CalculationPanel title="Jaarruimte / Lijfrente">
          <CalcSection>
            <CalcLine label={`${pct(opt.jaarruimtePercent)} × income`} value={cur((primaryTax?.grossIncome ?? grossIncome) * opt.jaarruimtePercent)} />
            <CalcLine label="− Franchise (AOW)" value={`- ${cur(opt.jaarruimteThreshold)}`} />
            <CalcLine label="− Factor A (pension)" value={`- ${cur(opt.factorA)}`} />
            <CalcSeparator />
            <CalcLine label="Jaarruimte" value={cur(jaarruimte)} bold />
            <CalcLine label="Your contribution" value={cur(opt.lijfrenteAnnualContribution)} />
            <CalcLine label="Deductible" value={cur(primaryTax?.lijfrenteDeduction ?? 0)} bold accent />
          </CalcSection>
          <CalcNote>
            Jaarruimte = max tax-deductible lijfrente contribution. Capped at {cur(opt.jaarruimteMax)}.
          </CalcNote>
        </CalculationPanel>
      )}

      {giftenaftrek > 0 && (
        <CalculationPanel title="Giftenaftrek">
          <CalcSection>
            {opt.giftenPeriodiek > 0 && <CalcLine label="Periodieke giften" value={cur(opt.giftenPeriodiek)} />}
            {opt.giftenRegular > 0 && (
              <>
                <CalcLine label="Regular gifts" value={cur(opt.giftenRegular)} />
                <CalcLine label={`Threshold (${pct(opt.giftenThresholdPercent)})`} value={`- ${cur((primaryTax?.grossIncome ?? grossIncome) * opt.giftenThresholdPercent)}`} indent={1} dimmed />
                <CalcLine label={`Cap (${pct(opt.giftenMaxPercent)})`} value={cur((primaryTax?.grossIncome ?? grossIncome) * opt.giftenMaxPercent)} indent={1} dimmed />
              </>
            )}
            <CalcSeparator />
            <CalcLine label="Total deduction" value={cur(giftenaftrek)} bold accent />
          </CalcSection>
        </CalculationPanel>
      )}

      {yearSummary && yearSummary.taxBox3 > 0 && (
        <CalculationPanel title="Box 3 — Wealth Tax">
          <CalcSection>
            <CalcLine label="Savings (cash)" value={cur(yearSummary.endCashBalance)} />
            <CalcLine label="Taxable investments" value={cur(yearSummary.endTaxableInvestmentValue)} />
            {yearSummary.box3PropertyValue > 0 && (
              <CalcLine label="Rental property value" value={`+ ${cur(yearSummary.box3PropertyValue)}`} />
            )}
            {yearSummary.box3MortgageDebt > 0 && (
              <CalcLine label="Rental property debt" value={`- ${cur(yearSummary.box3MortgageDebt)}`} />
            )}
            <CalcLine label={`Free threshold (${tax.filingType === 'couple' ? '2×' : ''}${cur(tax.box3.freeThreshold)})`} value={`- ${cur(tax.box3.freeThreshold * (tax.filingType === 'couple' ? 2 : 1))}`} />
            <CalcSeparator />
            <CalcLine label="Box 3 tax" value={cur(yearSummary.taxBox3)} bold accent />
          </CalcSection>
          <CalcNote>
            Fictional returns: savings {pct(tax.box3.savingsRate)}, investments {pct(tax.box3.investmentRate)}. Tax rate {pct(tax.box3.taxRate)}.
            {yearSummary.box3PropertyValue > 0 && ' Rental property counted at investment rate.'}
          </CalcNote>
        </CalculationPanel>
      )}

      {tax.filingType === 'couple' && (() => {
        const partnerGross = yearSummary?.partnerTax?.grossIncome ?? income.partnerGrossSalary * (1 + income.partnerHolidayAllowance);
        const totalInv = yearSummary?.endTaxableInvestmentValue ?? 0;
        const totalSavings = yearSummary?.endCashBalance ?? 0;
        const b3Debts = yearSummary?.box3MortgageDebt ?? 0;
        const b3Assets = yearSummary?.box3PropertyValue ?? 0;
        const opt2 = optimizeFiscaalPartnerschap(
          primaryTax?.grossIncome ?? grossIncome, partnerGross, mortgageInterest, ewf, tax,
          { savings: totalSavings, investments: totalInv, debts: b3Debts, otherAssets: b3Assets },
          { currentYear, box2Income: income.box2Income ?? 0 },
        );
        return opt2.taxSavings > 0 ? (
          <CalculationPanel title="Fiscaal Partnerschap">
            <CalcSection title="Optimal Allocation">
              <CalcLine label="Box 3 to primary" value={pct(opt2.optimalPrimarySplit)} />
              <CalcLine label="Box 3 to partner" value={pct(1 - opt2.optimalPrimarySplit)} />
              <CalcLine label="Mortgage deduction to primary" value={pct(opt2.optimalMortgageSplit)} />
              <CalcSeparator />
              <CalcLine label="Tax (default 50/50)" value={cur(opt2.totalTaxDefault)} />
              <CalcLine label="Tax (optimized)" value={cur(opt2.totalTaxOptimized)} />
              <CalcLine label="Potential savings" value={cur(opt2.taxSavings)} bold accent />
            </CalcSection>
            <CalcNote>
              Fiscal partners can allocate Box 3 assets and mortgage deductions freely. Optimal split minimizes combined tax.
            </CalcNote>
          </CalculationPanel>
        ) : null;
      })()}
    </div>
  );
}
