import { useActiveScenario } from '@/store';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur } from '@/components/common/CalculationPanel';
import { summarizeExpenses } from './expenseSummary';
import { getMortgageSnapshotAtDate } from '@/engine/mortgage';
import { getChildcareTypeLabel } from '@/lib/childcare';

export function ExpensesCalcSidebar() {
  const scenario = useActiveScenario();
  const { expenses: exp, tax } = scenario;
  const isCoupleHousehold = tax.filingType === 'couple';

  const totalMortgageMonthly = scenario.housing.properties.reduce(
    (sum, property) => sum + property.mortgages.reduce((mortgageSum, mortgage) => {
      const snapshot = getMortgageSnapshotAtDate(mortgage);
      return mortgageSum + (snapshot.hasStarted && !snapshot.isPaidOff ? snapshot.currentPayment : 0);
    }, 0),
    0,
  );

  const expenseSummary = summarizeExpenses(exp, isCoupleHousehold);
  const {
    monthlyFixed,
    monthlyVariable,
    annualTotal,
    annualMonthly,
    healthcareAnnual,
    healthcareMonthly,
    childDetails,
    totalChildMonthly,
    totalMonthly,
    totalAnnual,
    categoryRows,
  } = expenseSummary;

  return (
    <div className="space-y-3">
      <CalculationPanel title="Monthly Breakdown">
        <CalcSection title="Fixed Expenses">
          {exp.monthlyFixed.map((e) => (
            <CalcLine key={e.id} label={e.label || '(unnamed)'} value={cur(e.amount)} />
          ))}
          {exp.monthlyFixed.length === 0 && <CalcLine label="(none)" value="—" dimmed />}
          <CalcSeparator />
          <CalcLine label="Subtotal fixed" value={cur(monthlyFixed)} bold />
        </CalcSection>

        <CalcSection title="Variable Expenses">
          {exp.monthlyVariable.map((e) => (
            <CalcLine key={e.id} label={e.label || '(unnamed)'} value={cur(e.amount)} />
          ))}
          {exp.monthlyVariable.length === 0 && <CalcLine label="(none)" value="—" dimmed />}
          <CalcSeparator />
          <CalcLine label="Subtotal variable" value={cur(monthlyVariable)} bold />
        </CalcSection>

        <CalcSection title="Annual → Monthly">
          {exp.annualExpenses.map((e) => (
            <CalcLine key={e.id} label={e.label || '(unnamed)'} value={cur(e.amount)} />
          ))}
          <CalcSeparator />
          <CalcLine label="Annual total" value={cur(annualTotal)} />
          <CalcLine label="÷ 12 months" value={cur(annualMonthly)} bold />
        </CalcSection>

        <CalcSection title="Healthcare">
          <CalcLine label="Premium × 12" value={cur(exp.healthcareMonthlyPremium * 12)} />
          <CalcLine label="Eigen risico" value={cur(exp.healthcareDeductible)} />
          {isCoupleHousehold && (
            <>
              <CalcLine label="Partner premium × 12" value={cur((exp.partnerHealthcareMonthlyPremium ?? 0) * 12)} />
              <CalcLine label="Partner eigen risico" value={cur(exp.partnerHealthcareDeductible ?? 0)} />
            </>
          )}
          <CalcSeparator />
          <CalcLine label="Annual healthcare" value={cur(healthcareAnnual)} bold />
          <CalcLine label="Monthly" value={cur(healthcareMonthly)} dimmed />
        </CalcSection>
      </CalculationPanel>

      {childDetails.length > 0 && (
        <CalculationPanel title="Children Costs">
          <CalcSection>
            {childDetails.map((c, i) => (
              <div key={i} className="mb-2">
                <CalcLine label={`${c.name} (age ${c.age})`} value={cur(c.monthly + c.koMonthly)} />
                <CalcLine label={`Base × ${c.multiplier} (${c.bracket})`} value={cur(c.base)} indent={1} dimmed />
                {c.arrangements.map((arrangement) => (
                  <CalcLine
                    key={arrangement.id}
                    label={`Kinderopvang: ${getChildcareTypeLabel(arrangement.type)} · ${arrangement.hoursPerMonth}h × ${cur(arrangement.hourlyRate)}`}
                    value={cur(arrangement.monthlyCost)}
                    indent={1}
                    dimmed
                  />
                ))}
              </div>
            ))}
            <CalcSeparator />
            <CalcLine label="Total children/mo" value={cur(totalChildMonthly)} bold />
          </CalcSection>
          <CalcNote>
            Multipliers: 0–3 → 100%, 4–11 → 120%, 12–17 → 150%, 18–23 → 80%.
            {childDetails.some((c) => c.arrangements.length > 0) && ' Kinderopvang costs shown gross — toeslag offsets part of this.'}
          </CalcNote>
        </CalculationPanel>
      )}

      {categoryRows.length > 0 && (
        <CalculationPanel title="By Category">
          <CalcSection>
            {categoryRows.map(({ label, amount }) => (
              <CalcLine key={label} label={label} value={cur(amount)} />
            ))}
          </CalcSection>
        </CalculationPanel>
      )}

      <CalculationPanel title="Total Summary">
        <CalcSection>
          <CalcLine label="Fixed" value={cur(monthlyFixed)} />
          <CalcLine label="Variable" value={cur(monthlyVariable)} />
          <CalcLine label="Annual (÷12)" value={cur(annualMonthly)} />
          <CalcLine label="Healthcare" value={cur(healthcareMonthly)} />
          {totalChildMonthly > 0 && <CalcLine label="Children" value={cur(totalChildMonthly)} />}
          <CalcSeparator />
          <CalcLine label="TOTAL EXPENSES" value={cur(totalMonthly)} bold accent />
          <CalcLine label="Annual" value={cur(totalAnnual)} bold />
        </CalcSection>
        {totalMortgageMonthly > 0 && (
          <CalcSection title="Bank Account View">
            <CalcLine label="Expenses" value={cur(totalMonthly)} />
            <CalcLine label="Mortgage" value={cur(totalMortgageMonthly)} />
            <CalcSeparator />
            <CalcLine label="TOTAL OUTFLOWS" value={cur(totalMonthly + totalMortgageMonthly)} bold accent />
            <CalcNote>What actually leaves your bank account each month (excl. investment contributions).</CalcNote>
          </CalcSection>
        )}
        {exp.oneOffExpenses.length > 0 && (
          <CalcNote>
            + {exp.oneOffExpenses.length} one-off expense(s) totalling {cur(exp.oneOffExpenses.reduce((s, e) => s + e.amount, 0))}
          </CalcNote>
        )}
      </CalculationPanel>
    </div>
  );
}
