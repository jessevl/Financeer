import { useActiveScenario } from '@/store';
import { useSimulation } from '@/hooks/useSimulation';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur } from '@/components/common/CalculationPanel';

export function ExpensesCalcSidebar() {
  const scenario = useActiveScenario();
  const sim = useSimulation();
  const { expenses: exp, income } = scenario;
  const hasPartner = income.hasPartner;

  // Mortgage from simulation
  const currentYear = new Date().getFullYear();
  const yearSummary = sim.annualSummaries.find((s) => s.year === currentYear);
  const totalMortgageMonthly = yearSummary ? yearSummary.totalMortgagePayments / 12 : 0;

  const monthlyFixed = exp.monthlyFixed.reduce((s, e) => s + e.amount, 0);
  const monthlyVariable = exp.monthlyVariable.reduce((s, e) => s + e.amount, 0);
  const annualTotal = exp.annualExpenses.reduce((s, e) => s + e.amount, 0);
  const healthcare = exp.healthcareMonthlyPremium * 12 + exp.healthcareDeductible;
  const partnerHealthcare = hasPartner
    ? (exp.partnerHealthcareMonthlyPremium ?? 0) * 12 + (exp.partnerHealthcareDeductible ?? 0)
    : 0;
  const totalHealthcare = healthcare + partnerHealthcare;

  // Child cost with age multipliers + kinderopvang
  const now = new Date();
  const childDetails = exp.children.map((c) => {
    const birth = c.birthDate ? new Date(c.birthDate) : null;
    const age = birth ? Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 3600000)) : 0;
    let multiplier = 1.0;
    let bracket = '0–3';
    if (age >= 18) { multiplier = 0.8; bracket = '18–23'; }
    else if (age >= 12) { multiplier = 1.5; bracket = '12–17'; }
    else if (age >= 4) { multiplier = 1.2; bracket = '4–11'; }
    else { multiplier = 1.0; bracket = '0–3'; }

    const koType = (c as any).kinderopvangType ?? 'none';
    const koHours = (c as any).kinderopvangHoursPerMonth ?? 0;
    const koRate = (c as any).kinderopvangHourlyRate ?? 0;
    const koMonthly = koType !== 'none' ? koHours * koRate : 0;

    return {
      name: c.name || 'Child', age, bracket, base: c.monthlyExpense, multiplier,
      monthly: c.monthlyExpense * multiplier,
      koType, koHours, koRate, koMonthly,
    };
  });
  const totalChildMonthly = childDetails.reduce((s, c) => s + c.monthly + c.koMonthly, 0);

  const totalMonthly = monthlyFixed + monthlyVariable + annualTotal / 12 + totalHealthcare / 12 + totalChildMonthly;
  const totalAnnual = totalMonthly * 12;

  // Group by category
  const allMonthly = [...exp.monthlyFixed, ...exp.monthlyVariable];
  const categoryMap = new Map<string, number>();
  for (const item of allMonthly) {
    const cat = item.category || 'Uncategorized';
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + item.amount);
  }

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
          <CalcLine label="÷ 12 months" value={cur(annualTotal / 12)} bold />
        </CalcSection>

        <CalcSection title="Healthcare">
          <CalcLine label="Premium × 12" value={cur(exp.healthcareMonthlyPremium * 12)} />
          <CalcLine label="Eigen risico" value={cur(exp.healthcareDeductible)} />
          {hasPartner && (
            <>
              <CalcLine label="Partner premium × 12" value={cur((exp.partnerHealthcareMonthlyPremium ?? 0) * 12)} />
              <CalcLine label="Partner eigen risico" value={cur(exp.partnerHealthcareDeductible ?? 0)} />
            </>
          )}
          <CalcSeparator />
          <CalcLine label="Annual healthcare" value={cur(totalHealthcare)} bold />
          <CalcLine label="Monthly" value={cur(totalHealthcare / 12)} dimmed />
        </CalcSection>
      </CalculationPanel>

      {childDetails.length > 0 && (
        <CalculationPanel title="Children Costs">
          <CalcSection>
            {childDetails.map((c, i) => (
              <div key={i} className="mb-2">
                <CalcLine label={`${c.name} (age ${c.age})`} value={cur(c.monthly + c.koMonthly)} />
                <CalcLine label={`Base × ${c.multiplier} (${c.bracket})`} value={cur(c.base)} indent={1} dimmed />
                {c.koType !== 'none' && (
                  <CalcLine
                    label={`Kinderopvang: ${c.koHours}h × ${cur(c.koRate)}`}
                    value={cur(c.koMonthly)}
                    indent={1}
                    dimmed
                  />
                )}
              </div>
            ))}
            <CalcSeparator />
            <CalcLine label="Total children/mo" value={cur(totalChildMonthly)} bold />
          </CalcSection>
          <CalcNote>
            Multipliers: 0–3 → 100%, 4–11 → 120%, 12–17 → 150%, 18–23 → 80%.
            {childDetails.some((c) => c.koType !== 'none') && ' Kinderopvang costs shown gross — toeslag offsets part of this.'}
          </CalcNote>
        </CalculationPanel>
      )}

      {categoryMap.size > 0 && (
        <CalculationPanel title="By Category">
          <CalcSection>
            {[...categoryMap.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => (
                <CalcLine key={cat} label={cat} value={cur(amount)} />
              ))}
          </CalcSection>
        </CalculationPanel>
      )}

      <CalculationPanel title="Total Summary">
        <CalcSection>
          <CalcLine label="Fixed" value={cur(monthlyFixed)} />
          <CalcLine label="Variable" value={cur(monthlyVariable)} />
          <CalcLine label="Annual (÷12)" value={cur(annualTotal / 12)} />
          <CalcLine label="Healthcare" value={cur(totalHealthcare / 12)} />
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
