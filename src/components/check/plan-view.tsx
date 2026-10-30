"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { annualConsumptionKwh, tariffPerKwh, type BillDetails } from "@/lib/bill";
import { DEFAULT_COST_PER_KW, estimateRainwater, planSolar, subsidyCategoryForState } from "@/lib/engine";
import { fill, formatNumber, formatRupees } from "@/lib/format";
import type { RoofSnapshot } from "@/lib/imagery/esri";
import { ApplyGuide } from "./apply-guide";
import { MonthlyChart } from "./monthly-chart";
import { ReportSheet } from "./report-sheet";
import { RoofFigure } from "./roof-figure";
import type { Region, RoofState, SiteResources } from "./types";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className={emphasis ? "text-xl font-bold text-primary" : "font-semibold"}>{value}</dd>
    </div>
  );
}

const parsePositive = (text: string) => {
  const value = Number(text.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
};

export function PlanView({
  locale,
  snapshot,
  roofState,
  bill,
  region,
  resources,
  checkDict,
  disclaimer,
  onRetry,
  onBackToBill,
  onBackToRoof,
  onStartOver,
}: {
  locale: Locale;
  snapshot: RoofSnapshot;
  roofState: RoofState;
  bill: BillDetails;
  region?: Region;
  resources: SiteResources;
  checkDict: Dictionary["check"];
  disclaimer: string;
  onRetry: () => void;
  onBackToBill: () => void;
  onBackToRoof: () => void;
  onStartOver: () => void;
}) {
  const dict = checkDict.plan;
  const costId = useId();
  const rainId = useId();
  const [panelsOverride, setPanelsOverride] = useState<number | undefined>();
  const [costText, setCostText] = useState(String(DEFAULT_COST_PER_KW));
  const [rainfallText, setRainfallText] = useState<string | null>(null);

  const subsidyCategory = subsidyCategoryForState(region?.state);
  const annualUse = annualConsumptionKwh(bill);
  const costPerKw = parsePositive(costText) ?? DEFAULT_COST_PER_KW;

  const plan = useMemo(() => {
    if (resources.status !== "ready") return null;
    return planSolar({
      maxPanelsOnRoof: roofState.layout.panelCount,
      monthlyGhi: resources.monthlyGhi,
      annualConsumptionKwh: annualUse,
      tariffPerKwh: tariffPerKwh(bill),
      subsidyCategory,
      subsidyEligible: bill.residential,
      priorSubsidisedKw: bill.priorSubsidisedKw,
      sanctionedLoadKw: bill.sanctionedLoadKw,
      costPerKw,
      panelsOverride,
    });
  }, [resources, roofState.layout.panelCount, annualUse, bill, subsidyCategory, costPerKw, panelsOverride]);

  if (resources.status === "loading") {
    return (
      <p aria-live="polite" className="text-muted">
        {dict.loading}
      </p>
    );
  }
  if (resources.status === "error" || !plan) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-danger">{dict.dataError}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-ink"
        >
          {dict.retry}
        </button>
      </div>
    );
  }

  const rainfallMm = rainfallText !== null ? parsePositive(rainfallText) : (resources.rainfall?.annualMm ?? null);
  const rain =
    rainfallMm !== null
      ? estimateRainwater({
          roofAreaM2: roofState.layout.roofAreaM2,
          annualRainfallMm: rainfallMm,
          householdSize: bill.householdSize,
        })
      : null;

  const maxPanels = roofState.layout.panelCount;
  const changePanels = (delta: number) => setPanelsOverride(Math.min(Math.max(plan.panels + delta, 1), maxPanels));

  const warnings = [
    plan.exceedsSanctionedLoad && bill.sanctionedLoadKw !== undefined
      ? fill(dict.warnings.sanctioned, { value: formatNumber(bill.sanctionedLoadKw, 2) })
      : null,
    !bill.residential ? dict.warnings.nonResidential : null,
    bill.residential && bill.priorSubsidisedKw
      ? fill(dict.warnings.priorSubsidy, { value: formatNumber(bill.priorSubsidisedKw, 2) })
      : null,
  ].filter((w): w is string => w !== null);

  return (
    <>
      <div className="space-y-6 print:hidden">
        <section
          className="grid gap-5 rounded-2xl border border-border bg-primary-soft p-5 sm:grid-cols-[200px_1fr]"
          aria-live="polite"
        >
          <RoofFigure
            snapshot={snapshot}
            roofState={roofState}
            panelCount={plan.panels}
            label={checkDict.report.roofSection}
            className="w-full rounded-xl"
          />
          <div>
            <h2 className="text-sm font-semibold text-primary">{dict.recommended}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <p className="text-3xl font-bold">
                {fill(dict.panelsAndKw, { panels: plan.panels, kw: formatNumber(plan.capacityKw, 2) })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={dict.fewer}
                  onClick={() => changePanels(-1)}
                  disabled={plan.panels <= 1}
                  className="h-10 w-10 rounded-full border border-border bg-surface text-xl font-bold disabled:opacity-40"
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={dict.more}
                  onClick={() => changePanels(1)}
                  disabled={plan.panels >= maxPanels}
                  className="h-10 w-10 rounded-full border border-border bg-surface text-xl font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            <p className="mt-2 text-muted">{dict.sizedBy[plan.sizedBy]}</p>
          </div>
        </section>

        {warnings.length > 0 && (
          <ul role="status" className="space-y-2">
            {warnings.map((warning) => (
              <li key={warning} className="rounded-xl border border-warn/40 bg-surface p-3 text-sm">
                {warning}
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={dict.costTitle}>
            <dl>
              <Stat label={dict.grossCost} value={formatRupees(plan.grossCost)} />
              <Stat label={dict.subsidy} value={`− ${formatRupees(plan.subsidy)}`} />
              <Stat label={dict.netCost} value={formatRupees(plan.netCost)} emphasis />
            </dl>
            {subsidyCategory === "special" && bill.residential && region?.state && (
              <p className="text-sm text-muted">{fill(dict.specialCategory, { state: region.state })}</p>
            )}
            <div className="space-y-1">
              <label htmlFor={costId} className="block text-sm font-medium">
                {dict.costPerKw}
              </label>
              <input
                id={costId}
                inputMode="numeric"
                value={costText}
                onChange={(event) => setCostText(event.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2"
              />
              <p className="text-sm text-muted">{dict.costPerKwHint}</p>
            </div>
          </Card>

          <Card title={dict.savingsTitle}>
            <dl>
              <Stat label={dict.annualSavings} value={formatRupees(plan.annualSavings)} />
              <Stat
                label={dict.payback}
                value={
                  plan.paybackYears !== null
                    ? fill(dict.years, { value: formatNumber(plan.paybackYears, 1) })
                    : dict.noPayback
                }
                emphasis
              />
              <Stat label={dict.lifetime} value={formatRupees(plan.lifetimeSavings)} />
            </dl>
          </Card>
        </div>

        <Card title={dict.generationTitle}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">{dict.annualGeneration}</dt>
              <dd className="text-2xl font-bold">{formatNumber(plan.annualGenerationKwh)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{dict.covered}</dt>
              <dd className="text-2xl font-bold">{formatNumber(Math.min(plan.consumptionCovered, 9.99) * 100)}%</dd>
            </div>
          </dl>
          <MonthlyChart
            generation={plan.monthlyGenerationKwh}
            monthlyUse={annualUse / 12}
            months={dict.months}
            dict={{
              title: dict.chartTitle,
              use: dict.chartUse,
              showTable: dict.showTable,
              monthHeader: dict.monthHeader,
              unitsHeader: dict.unitsHeader,
            }}
          />
        </Card>

        <Card title={dict.rainTitle}>
          {rain ? (
            <div>
              <p className="text-2xl font-bold">{fill(dict.litres, { value: formatNumber(rain.annualLitres) })}</p>
              <p className="text-muted">{fill(dict.days, { value: formatNumber(rain.householdDays) })}</p>
            </div>
          ) : (
            resources.rainfall === null && rainfallText === null && <p className="text-muted">{dict.rainError}</p>
          )}
          <div className="space-y-1">
            <label htmlFor={rainId} className="block text-sm font-medium">
              {dict.rainfall}
            </label>
            <input
              id={rainId}
              inputMode="numeric"
              value={rainfallText ?? (resources.rainfall ? String(Math.round(resources.rainfall.annualMm)) : "")}
              onChange={(event) => setRainfallText(event.target.value)}
              className="w-full max-w-xs rounded-xl border border-border bg-surface px-4 py-2"
            />
            {resources.rainfall && (
              <p className="text-sm text-muted">
                {fill(dict.rainfallSource, { first: resources.rainfall.firstYear, last: resources.rainfall.lastYear })}
              </p>
            )}
          </div>
        </Card>

        <Card title={checkDict.apply.title}>
          <ApplyGuide dict={checkDict.apply} capacityKw={plan.capacityKw} bill={bill} region={region} />
        </Card>

        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-5">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-ink px-6 py-3 font-semibold text-bg"
          >
            {checkDict.report.download}
          </button>
          <p className="text-sm text-muted">{checkDict.report.downloadHint}</p>
        </section>

        <details className="rounded-2xl border border-border bg-surface p-5">
          <summary className="cursor-pointer font-semibold">{dict.howTitle}</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {dict.howItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>

        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={onBackToBill} className="text-sm font-medium text-primary underline">
            {dict.backToBill}
          </button>
          <button type="button" onClick={onBackToRoof} className="text-sm font-medium text-primary underline">
            {dict.backToRoof}
          </button>
          <button type="button" onClick={onStartOver} className="text-sm font-medium text-primary underline">
            {checkDict.report.startOver}
          </button>
        </div>
      </div>
      <ReportSheet
        locale={locale}
        dict={checkDict}
        snapshot={snapshot}
        region={region}
        roofState={roofState}
        bill={bill}
        plan={plan}
        rain={rain}
        rainfallMm={rainfallMm}
        disclaimer={disclaimer}
      />
    </>
  );
}
