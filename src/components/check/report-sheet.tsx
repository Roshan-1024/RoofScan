import type { ReactNode } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { annualConsumptionKwh, tariffPerKwh, type BillDetails } from "@/lib/bill";
import type { RainwaterEstimate, SolarPlan } from "@/lib/engine";
import { fill, formatNumber, formatRupees, SQFT_PER_SQM } from "@/lib/format";
import { ESRI_ATTRIBUTION, type RoofSnapshot } from "@/lib/imagery/esri";
import { ApplyGuide, PM_SURYA_GHAR_PORTAL } from "./apply-guide";
import { RoofFigure } from "./roof-figure";
import type { Region, RoofState } from "./types";

function Section({ title, children, breakable }: { title: string; children: ReactNode; breakable?: boolean }) {
  return (
    <section className={`space-y-2 ${breakable ? "" : "break-inside-avoid"}`}>
      <h2 className="border-b border-black/20 pb-1 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-black/10">
            <td className="py-1 pr-4">{label}</td>
            <td className="py-1 text-right font-semibold">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Print-only summary of the check. The browser's "Save as PDF" turns it into
 * the report, which keeps Hindi text shaping correct.
 */
export function ReportSheet({
  locale,
  dict,
  snapshot,
  region,
  roofState,
  bill,
  plan,
  rain,
  rainfallMm,
  disclaimer,
}: {
  locale: Locale;
  dict: Dictionary["check"];
  snapshot: RoofSnapshot;
  region?: Region;
  roofState: RoofState;
  bill: BillDetails;
  plan: SolarPlan;
  rain: RainwaterEstimate | null;
  rainfallMm: number | null;
  disclaimer: string;
}) {
  const date = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { dateStyle: "long" }).format(new Date());
  const { report, plan: planDict, roof: roofDict } = dict;
  const area = (m2: number) => `${formatNumber(m2)} ${roofDict.sqm} (${formatNumber(m2 * SQFT_PER_SQM)} ${roofDict.sqft})`;
  const place = [region?.district, region?.state].filter(Boolean).join(", ");

  return (
    <article className="hidden space-y-5 text-black print:block">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <p className="text-sm">{fill(report.prepared, { date })}</p>
        <p className="text-sm">
          {report.location}: {place && `${place} · `}
          {snapshot.center.lat.toFixed(5)}, {snapshot.center.lon.toFixed(5)}
        </p>
      </header>

      <div className="grid grid-cols-[1fr_1fr] gap-5">
        <div>
          <RoofFigure
            snapshot={snapshot}
            roofState={roofState}
            panelCount={plan.panels}
            label={report.roofSection}
            className="w-full rounded border border-black/20"
          />
          <p className="mt-1 text-[10px]">{snapshot.source === "esri" ? ESRI_ATTRIBUTION : roofDict.ownPhoto}</p>
        </div>
        <div className="space-y-5">
          <Section title={report.roofSection}>
            <Rows
              rows={[
                [roofDict.roofArea, area(roofState.layout.roofAreaM2)],
                [roofDict.usableArea, area(roofState.layout.usableAreaM2)],
                [roofDict.panels, String(roofState.layout.panelCount)],
              ]}
            />
          </Section>
          <Section title={report.systemSection}>
            <Rows
              rows={[
                [planDict.recommended, fill(planDict.panelsAndKw, { panels: plan.panels, kw: formatNumber(plan.capacityKw, 2) })],
                [planDict.annualGeneration, formatNumber(plan.annualGenerationKwh)],
                [planDict.covered, `${formatNumber(Math.min(plan.consumptionCovered, 9.99) * 100)}%`],
              ]}
            />
          </Section>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Section title={report.moneySection}>
          <Rows
            rows={[
              [planDict.grossCost, formatRupees(plan.grossCost)],
              [planDict.subsidy, `− ${formatRupees(plan.subsidy)}`],
              [planDict.netCost, formatRupees(plan.netCost)],
              [planDict.annualSavings, formatRupees(plan.annualSavings)],
              [
                planDict.payback,
                plan.paybackYears !== null ? fill(planDict.years, { value: formatNumber(plan.paybackYears, 1) }) : planDict.noPayback,
              ],
              [planDict.lifetime, formatRupees(plan.lifetimeSavings)],
            ]}
          />
        </Section>
        <Section title={report.billSection}>
          <Rows
            rows={[
              [report.monthlyUse, fill(report.units, { value: formatNumber(annualConsumptionKwh(bill) / 12) })],
              [report.pricePerUnit, `₹${formatNumber(tariffPerKwh(bill), 2)}`],
            ]}
          />
        </Section>
      </div>

      <Section title={planDict.chartTitle}>
        <table className="w-full text-center text-xs">
          <thead>
            <tr>
              {planDict.months.map((month) => (
                <th key={month} className="font-semibold">
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {plan.monthlyGenerationKwh.map((value, month) => (
                <td key={month}>{formatNumber(value)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </Section>

      {rain && rainfallMm !== null && (
        <Section title={report.rainSection}>
          <p className="text-sm">
            {[
              fill(planDict.litres, { value: formatNumber(rain.annualLitres) }),
              fill(planDict.days, { value: formatNumber(rain.householdDays) }),
              fill(report.rainfallUsed, { value: formatNumber(rainfallMm) }),
            ].join(" · ")}
          </p>
        </Section>
      )}

      <Section title={dict.apply.title} breakable>
        <div className="text-sm">
          <ApplyGuide dict={dict.apply} capacityKw={plan.capacityKw} bill={bill} region={region} showPortalLink={false} />
          <p className="mt-2">{PM_SURYA_GHAR_PORTAL}</p>
        </div>
      </Section>

      <Section title={report.assumptionsSection}>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          {planDict.howItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-xs">{disclaimer}</p>
      </Section>
    </article>
  );
}
