import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getTaxPreset } from '@/data/taxPresets';
import { getToeslagenPreset } from '@/data/toeslagenPresets';
import { useActiveScenario, useSettings } from '@/store';
import { formatCurrency, formatPercent } from '@/lib/format';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Row({ label, preset, current, format = 'currency' }: {
  label: string;
  preset: number | null | undefined;
  current: number | null | undefined;
  format?: 'currency' | 'percent' | 'number';
}) {
  const fmt = (v: number | null | undefined) => {
    if (v === null) return '∞';
    if (v === undefined) return '—';
    if (format === 'percent') return formatPercent(v, 2);
    if (format === 'currency') return formatCurrency(v);
    return v.toLocaleString('nl-NL');
  };

  const isOverridden = preset !== current;

  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={isOverridden ? 'text-amber-600 font-semibold' : 'text-foreground'}>
        {fmt(current)}
        {isOverridden && (
          <span className="text-muted-foreground ml-1 font-normal">(preset: {fmt(preset)})</span>
        )}
      </span>
    </div>
  );
}

function Section({ title, children, overrideCount }: { title: string; children: React.ReactNode; overrideCount: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {overrideCount > 0 && (
          <span className="text-[10px] text-amber-600 font-medium">{overrideCount} overridden</span>
        )}
      </div>
      <div className="border-l-2 border-muted pl-3 py-1">{children}</div>
    </div>
  );
}

export function TaxLawVerificationBox() {
  const [expanded, setExpanded] = useState(false);
  const settings = useSettings();
  const scenario = useActiveScenario();
  const year = settings.taxLawYear;

  const taxPreset = getTaxPreset(year);
  const toeslagenPreset = getToeslagenPreset(year);

  const tax = scenario.tax;
  const toeslagen = scenario.toeslagen;

  // Count overrides
  let presetCount = 0;
  let overrideCount = 0;

  function check(presetVal: number | null | undefined, currentVal: number | null | undefined) {
    presetCount++;
    if (presetVal !== currentVal) overrideCount++;
  }

  // Tax overrides
  taxPreset.box1Brackets.forEach((b, i) => {
    const cur = tax.box1Brackets[i];
    if (cur) {
      check(b.upperLimit, cur.upperLimit);
      check(b.rate, cur.rate);
    }
  });
  check(taxPreset.generalTaxCredit.maxAmount, tax.generalTaxCredit.maxAmount);
  check(taxPreset.generalTaxCredit.phaseOutStart, tax.generalTaxCredit.phaseOutStart);
  check(taxPreset.generalTaxCredit.phaseOutEnd, tax.generalTaxCredit.phaseOutEnd);
  check(taxPreset.labourTaxCredit.maxAmount, tax.labourTaxCredit.maxAmount);
  check(taxPreset.labourTaxCredit.buildUpStart, tax.labourTaxCredit.buildUpStart);
  check(taxPreset.labourTaxCredit.buildUpEnd, tax.labourTaxCredit.buildUpEnd);
  check(taxPreset.labourTaxCredit.phaseOutStart, tax.labourTaxCredit.phaseOutStart);
  check(taxPreset.labourTaxCredit.phaseOutEnd, tax.labourTaxCredit.phaseOutEnd);
  check(taxPreset.box2.lowerRate, tax.box2.lowerRate);
  check(taxPreset.box2.lowerBracketLimit, tax.box2.lowerBracketLimit);
  check(taxPreset.box2.upperRate, tax.box2.upperRate);
  check(taxPreset.box3.freeThreshold, tax.box3.freeThreshold);
  check(taxPreset.box3.taxRate, tax.box3.taxRate);
  check(taxPreset.box3.savingsRate, tax.box3.savingsRate);
  check(taxPreset.box3.investmentRate, tax.box3.investmentRate);
  check(taxPreset.box3.debtRate, tax.box3.debtRate);
  check(taxPreset.box3.debtThreshold, tax.box3.debtThreshold);
  check(taxPreset.socialContributions.zvwRate, tax.socialContributions.zvwRate);
  check(taxPreset.socialContributions.zvwMaxIncome, tax.socialContributions.zvwMaxIncome);
  check(taxPreset.eigenwoningforfaitRate, tax.eigenwoningforfaitRate);
  check(taxPreset.eigenwoningforfaitThreshold, tax.eigenwoningforfaitThreshold);
  check(taxPreset.iack.maxAmount, tax.iack.maxAmount);
  check(taxPreset.iack.incomeThreshold, tax.iack.incomeThreshold);
  check(taxPreset.iack.buildUpRate, tax.iack.buildUpRate);
  check(taxPreset.ouderenkorting.maxAmount, tax.ouderenkorting.maxAmount);
  check(taxPreset.ouderenkorting.phaseOutStart, tax.ouderenkorting.phaseOutStart);
  check(taxPreset.ouderenkorting.phaseOutRate, tax.ouderenkorting.phaseOutRate);
  check(taxPreset.ouderenkorting.alleenstaandAmount, tax.ouderenkorting.alleenstaandAmount);
  check(taxPreset.jonggehandicaptenkorting, tax.jonggehandicaptenkorting);
  check(taxPreset.taxOptimizations.greenExemptionPerPerson, tax.taxOptimizations.greenExemptionPerPerson);
  check(taxPreset.taxOptimizations.greenTaxCredit, tax.taxOptimizations.greenTaxCredit);

  // Toeslagen overrides
  check(toeslagenPreset.zorgtoeslag.standaardpremie, toeslagen.zorgtoeslag.standaardpremie);
  check(toeslagenPreset.zorgtoeslag.drempelinkomen, toeslagen.zorgtoeslag.drempelinkomen);
  check(toeslagenPreset.zorgtoeslag.vermogensGrensSingle, toeslagen.zorgtoeslag.vermogensGrensSingle);
  check(toeslagenPreset.zorgtoeslag.vermogensGrensCouple, toeslagen.zorgtoeslag.vermogensGrensCouple);
  check(toeslagenPreset.kindgebondenBudget.basePerChild, toeslagen.kindgebondenBudget.basePerChild);
  check(toeslagenPreset.kindgebondenBudget.singleParentExtra, toeslagen.kindgebondenBudget.singleParentExtra);
  check(toeslagenPreset.kindgebondenBudget.reductionRate, toeslagen.kindgebondenBudget.reductionRate);
  check(toeslagenPreset.kinderbijslag.quarterly0to5, toeslagen.kinderbijslag.quarterly0to5);
  check(toeslagenPreset.kinderbijslag.quarterly6to11, toeslagen.kinderbijslag.quarterly6to11);
  check(toeslagenPreset.kinderbijslag.quarterly12to17, toeslagen.kinderbijslag.quarterly12to17);
  check(toeslagenPreset.huurtoeslag.basishuur, toeslagen.huurtoeslag.basishuur);
  check(toeslagenPreset.huurtoeslag.maxHuur, toeslagen.huurtoeslag.maxHuur);
  check(toeslagenPreset.huurtoeslag.maxInkomenSingle, toeslagen.huurtoeslag.maxInkomenSingle);

  // Bracket override count (for section counters)
  let bracketOverrides = 0;
  taxPreset.box1Brackets.forEach((b, i) => {
    const cur = tax.box1Brackets[i];
    if (cur) {
      if (b.upperLimit !== cur.upperLimit) bracketOverrides++;
      if (b.rate !== cur.rate) bracketOverrides++;
    }
  });

  const creditOverrides = [
    taxPreset.generalTaxCredit.maxAmount !== tax.generalTaxCredit.maxAmount,
    taxPreset.generalTaxCredit.phaseOutStart !== tax.generalTaxCredit.phaseOutStart,
    taxPreset.generalTaxCredit.phaseOutEnd !== tax.generalTaxCredit.phaseOutEnd,
    taxPreset.labourTaxCredit.maxAmount !== tax.labourTaxCredit.maxAmount,
    taxPreset.labourTaxCredit.buildUpStart !== tax.labourTaxCredit.buildUpStart,
    taxPreset.labourTaxCredit.buildUpEnd !== tax.labourTaxCredit.buildUpEnd,
    taxPreset.labourTaxCredit.phaseOutStart !== tax.labourTaxCredit.phaseOutStart,
    taxPreset.labourTaxCredit.phaseOutEnd !== tax.labourTaxCredit.phaseOutEnd,
    taxPreset.iack.maxAmount !== tax.iack.maxAmount,
    taxPreset.iack.incomeThreshold !== tax.iack.incomeThreshold,
    taxPreset.iack.buildUpRate !== tax.iack.buildUpRate,
    taxPreset.ouderenkorting.maxAmount !== tax.ouderenkorting.maxAmount,
    taxPreset.ouderenkorting.phaseOutStart !== tax.ouderenkorting.phaseOutStart,
    taxPreset.ouderenkorting.phaseOutRate !== tax.ouderenkorting.phaseOutRate,
    taxPreset.jonggehandicaptenkorting !== tax.jonggehandicaptenkorting,
  ].filter(Boolean).length;

  const box2Overrides = [
    taxPreset.box2.lowerRate !== tax.box2.lowerRate,
    taxPreset.box2.lowerBracketLimit !== tax.box2.lowerBracketLimit,
    taxPreset.box2.upperRate !== tax.box2.upperRate,
  ].filter(Boolean).length;

  const box3Overrides = [
    taxPreset.box3.freeThreshold !== tax.box3.freeThreshold,
    taxPreset.box3.taxRate !== tax.box3.taxRate,
    taxPreset.box3.savingsRate !== tax.box3.savingsRate,
    taxPreset.box3.investmentRate !== tax.box3.investmentRate,
    taxPreset.box3.debtRate !== tax.box3.debtRate,
    taxPreset.box3.debtThreshold !== tax.box3.debtThreshold,
  ].filter(Boolean).length;

  const socialOverrides = [
    taxPreset.socialContributions.zvwRate !== tax.socialContributions.zvwRate,
    taxPreset.socialContributions.zvwMaxIncome !== tax.socialContributions.zvwMaxIncome,
    taxPreset.eigenwoningforfaitRate !== tax.eigenwoningforfaitRate,
    taxPreset.eigenwoningforfaitThreshold !== tax.eigenwoningforfaitThreshold,
  ].filter(Boolean).length;

  const toeslagenOverrides = [
    toeslagenPreset.zorgtoeslag.standaardpremie !== toeslagen.zorgtoeslag.standaardpremie,
    toeslagenPreset.zorgtoeslag.drempelinkomen !== toeslagen.zorgtoeslag.drempelinkomen,
    toeslagenPreset.zorgtoeslag.vermogensGrensSingle !== toeslagen.zorgtoeslag.vermogensGrensSingle,
    toeslagenPreset.kindgebondenBudget.basePerChild !== toeslagen.kindgebondenBudget.basePerChild,
    toeslagenPreset.kinderbijslag.quarterly0to5 !== toeslagen.kinderbijslag.quarterly0to5,
    toeslagenPreset.kinderbijslag.quarterly6to11 !== toeslagen.kinderbijslag.quarterly6to11,
    toeslagenPreset.kinderbijslag.quarterly12to17 !== toeslagen.kinderbijslag.quarterly12to17,
    toeslagenPreset.huurtoeslag.basishuur !== toeslagen.huurtoeslag.basishuur,
    toeslagenPreset.huurtoeslag.maxHuur !== toeslagen.huurtoeslag.maxHuur,
    toeslagenPreset.huurtoeslag.maxInkomenSingle !== toeslagen.huurtoeslag.maxInkomenSingle,
  ].filter(Boolean).length;

  return (
    <Card className={overrideCount > 0 ? 'border-amber-300/50' : 'border-green-300/50'}>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {overrideCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            )}
            Tax Law Verification — {year}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>
          {presetCount} law-driven parameters checked —{' '}
          {overrideCount > 0 ? (
            <span className="text-amber-600 font-medium">{overrideCount} overridden</span>
          ) : (
            <span className="text-green-600 font-medium">all match preset</span>
          )}
        </CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 pt-0">
          <Section title="Box 1 Brackets" overrideCount={bracketOverrides}>
            {taxPreset.box1Brackets.map((b, i) => {
              const cur = tax.box1Brackets[i];
              if (!cur) return null;
              return (
                <div key={i}>
                  <Row label={`Bracket ${i + 1} upper limit`} preset={b.upperLimit} current={cur.upperLimit} />
                  <Row label={`Bracket ${i + 1} rate`} preset={b.rate} current={cur.rate} format="percent" />
                </div>
              );
            })}
          </Section>

          <Section title="Tax Credits (Heffingskortingen)" overrideCount={creditOverrides}>
            <Row label="General credit max" preset={taxPreset.generalTaxCredit.maxAmount} current={tax.generalTaxCredit.maxAmount} />
            <Row label="General phase-out start" preset={taxPreset.generalTaxCredit.phaseOutStart} current={tax.generalTaxCredit.phaseOutStart} />
            <Row label="General phase-out end" preset={taxPreset.generalTaxCredit.phaseOutEnd} current={tax.generalTaxCredit.phaseOutEnd} />
            <Row label="Labour credit max" preset={taxPreset.labourTaxCredit.maxAmount} current={tax.labourTaxCredit.maxAmount} />
            <Row label="Labour build-up start" preset={taxPreset.labourTaxCredit.buildUpStart} current={tax.labourTaxCredit.buildUpStart} />
            <Row label="Labour build-up end" preset={taxPreset.labourTaxCredit.buildUpEnd} current={tax.labourTaxCredit.buildUpEnd} />
            <Row label="Labour phase-out start" preset={taxPreset.labourTaxCredit.phaseOutStart} current={tax.labourTaxCredit.phaseOutStart} />
            <Row label="Labour phase-out end" preset={taxPreset.labourTaxCredit.phaseOutEnd} current={tax.labourTaxCredit.phaseOutEnd} />
            <Row label="IACK max" preset={taxPreset.iack.maxAmount} current={tax.iack.maxAmount} />
            <Row label="IACK income threshold" preset={taxPreset.iack.incomeThreshold} current={tax.iack.incomeThreshold} />
            <Row label="IACK build-up rate" preset={taxPreset.iack.buildUpRate} current={tax.iack.buildUpRate} format="percent" />
            <Row label="Ouderenkorting max" preset={taxPreset.ouderenkorting.maxAmount} current={tax.ouderenkorting.maxAmount} />
            <Row label="Ouderenkorting phase-out start" preset={taxPreset.ouderenkorting.phaseOutStart} current={tax.ouderenkorting.phaseOutStart} />
            <Row label="Ouderenkorting phase-out rate" preset={taxPreset.ouderenkorting.phaseOutRate} current={tax.ouderenkorting.phaseOutRate} format="percent" />
            <Row label="Alleenstaande ouderenkorting" preset={taxPreset.ouderenkorting.alleenstaandAmount} current={tax.ouderenkorting.alleenstaandAmount} />
            <Row label="Jonggehandicaptenkorting" preset={taxPreset.jonggehandicaptenkorting} current={tax.jonggehandicaptenkorting} />
          </Section>

          <Section title="Box 2 — Substantial Interest" overrideCount={box2Overrides}>
            <Row label="Lower rate" preset={taxPreset.box2.lowerRate} current={tax.box2.lowerRate} format="percent" />
            <Row label="Bracket limit" preset={taxPreset.box2.lowerBracketLimit} current={tax.box2.lowerBracketLimit} />
            <Row label="Upper rate" preset={taxPreset.box2.upperRate} current={tax.box2.upperRate} format="percent" />
          </Section>

          <Section title="Box 3 — Wealth Tax" overrideCount={box3Overrides}>
            <Row label="Free threshold" preset={taxPreset.box3.freeThreshold} current={tax.box3.freeThreshold} />
            <Row label="Tax rate" preset={taxPreset.box3.taxRate} current={tax.box3.taxRate} format="percent" />
            <Row label="Savings rate" preset={taxPreset.box3.savingsRate} current={tax.box3.savingsRate} format="percent" />
            <Row label="Investment rate" preset={taxPreset.box3.investmentRate} current={tax.box3.investmentRate} format="percent" />
            <Row label="Debt rate" preset={taxPreset.box3.debtRate} current={tax.box3.debtRate} format="percent" />
            <Row label="Debt threshold" preset={taxPreset.box3.debtThreshold} current={tax.box3.debtThreshold} />
            <Row label="Green exemption/person" preset={taxPreset.taxOptimizations.greenExemptionPerPerson} current={tax.taxOptimizations.greenExemptionPerPerson} />
            <Row label="Green tax credit" preset={taxPreset.taxOptimizations.greenTaxCredit} current={tax.taxOptimizations.greenTaxCredit} format="percent" />
          </Section>

          <Section title="Social Contributions & EWF" overrideCount={socialOverrides}>
            <Row label="ZVW rate" preset={taxPreset.socialContributions.zvwRate} current={tax.socialContributions.zvwRate} format="percent" />
            <Row label="ZVW max income" preset={taxPreset.socialContributions.zvwMaxIncome} current={tax.socialContributions.zvwMaxIncome} />
            <Row label="EWF rate" preset={taxPreset.eigenwoningforfaitRate} current={tax.eigenwoningforfaitRate} format="percent" />
            <Row label="EWF threshold" preset={taxPreset.eigenwoningforfaitThreshold} current={tax.eigenwoningforfaitThreshold} />
          </Section>

          <Section title="Toeslagen" overrideCount={toeslagenOverrides}>
            <Row label="Zorgtoeslag standaardpremie" preset={toeslagenPreset.zorgtoeslag.standaardpremie} current={toeslagen.zorgtoeslag.standaardpremie} />
            <Row label="Zorgtoeslag drempelinkomen" preset={toeslagenPreset.zorgtoeslag.drempelinkomen} current={toeslagen.zorgtoeslag.drempelinkomen} />
            <Row label="Zorgtoeslag vermogensgrens (single)" preset={toeslagenPreset.zorgtoeslag.vermogensGrensSingle} current={toeslagen.zorgtoeslag.vermogensGrensSingle} />
            <Row label="Zorgtoeslag vermogensgrens (couple)" preset={toeslagenPreset.zorgtoeslag.vermogensGrensCouple} current={toeslagen.zorgtoeslag.vermogensGrensCouple} />
            <Row label="KGB per child" preset={toeslagenPreset.kindgebondenBudget.basePerChild} current={toeslagen.kindgebondenBudget.basePerChild} />
            <Row label="KGB single parent extra" preset={toeslagenPreset.kindgebondenBudget.singleParentExtra} current={toeslagen.kindgebondenBudget.singleParentExtra} />
            <Row label="KGB reduction rate" preset={toeslagenPreset.kindgebondenBudget.reductionRate} current={toeslagen.kindgebondenBudget.reductionRate} format="percent" />
            <Row label="Kinderbijslag 0–5 (quarterly)" preset={toeslagenPreset.kinderbijslag.quarterly0to5} current={toeslagen.kinderbijslag.quarterly0to5} />
            <Row label="Kinderbijslag 6–11 (quarterly)" preset={toeslagenPreset.kinderbijslag.quarterly6to11} current={toeslagen.kinderbijslag.quarterly6to11} />
            <Row label="Kinderbijslag 12–17 (quarterly)" preset={toeslagenPreset.kinderbijslag.quarterly12to17} current={toeslagen.kinderbijslag.quarterly12to17} />
            <Row label="Huurtoeslag basishuur" preset={toeslagenPreset.huurtoeslag.basishuur} current={toeslagen.huurtoeslag.basishuur} />
            <Row label="Huurtoeslag max huur" preset={toeslagenPreset.huurtoeslag.maxHuur} current={toeslagen.huurtoeslag.maxHuur} />
            <Row label="Huurtoeslag max income (single)" preset={toeslagenPreset.huurtoeslag.maxInkomenSingle} current={toeslagen.huurtoeslag.maxInkomenSingle} />
          </Section>
        </CardContent>
      )}
    </Card>
  );
}
