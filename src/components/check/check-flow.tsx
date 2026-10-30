"use client";

import { useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import type { BillDetails } from "@/lib/bill";
import type { RoofSnapshot } from "@/lib/imagery/esri";
import { BillForm } from "./bill-form";
import { FindHouse } from "./find-house";
import { PlanView } from "./plan-view";
import { RoofEditor } from "./roof-editor";
import type { RainfallData, Region, RoofState, SiteResources } from "./types";

interface SelectedSite {
  snapshot: RoofSnapshot;
  region?: Region;
}

type Step = 0 | 1 | 2 | 3;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

export function CheckFlow({ locale, dict }: { locale: Locale; dict: Dictionary["check"] }) {
  const [step, setStep] = useState<Step>(0);
  const [site, setSite] = useState<SelectedSite | null>(null);
  const [roofState, setRoofState] = useState<RoofState | null>(null);
  const [bill, setBill] = useState<BillDetails | null>(null);
  const [resources, setResources] = useState<SiteResources>({ status: "loading" });

  const steps = [dict.steps.find, dict.steps.roof, dict.steps.bill, dict.steps.plan];

  function goTo(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadResources(lat: number, lon: number) {
    setResources({ status: "loading" });
    const query = `lat=${lat}&lon=${lon}`;
    Promise.all([
      getJson<{ monthlyGhi: number[] }>(`/api/solar-resource?${query}`),
      // Rainfall is optional: the household can type it in if the lookup fails.
      getJson<RainfallData>(`/api/rainfall?${query}`).catch(() => null),
    ])
      .then(([solar, rainfall]) => setResources({ status: "ready", monthlyGhi: solar.monthlyGhi, rainfall }))
      .catch(() => setResources({ status: "error" }));
  }

  function handleSelected(selected: SelectedSite) {
    setSite(selected);
    setRoofState(null);
    loadResources(selected.snapshot.center.lat, selected.snapshot.center.lon);
    goTo(1);
  }

  return (
    <div className="mt-6">
      <ol className="mb-6 flex flex-wrap gap-2 text-sm" aria-label={dict.title}>
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`rounded-full px-3 py-1 font-medium ${
              index === step ? "bg-primary text-primary-ink" : "bg-surface-muted text-muted"
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 || !site ? (
        <FindHouse locale={locale} dict={dict.find} onSelected={handleSelected} />
      ) : step === 1 || !roofState ? (
        <RoofEditor
          key={`${site.snapshot.center.lat},${site.snapshot.center.lon},${site.snapshot.zoom}`}
          snapshot={site.snapshot}
          region={site.region}
          initial={roofState ?? undefined}
          dict={dict.roof}
          onBack={() => goTo(0)}
          onContinue={(state) => {
            setRoofState(state);
            goTo(2);
          }}
        />
      ) : step === 2 || !bill ? (
        <BillForm
          initial={bill ?? undefined}
          dict={dict.bill}
          onBack={() => goTo(1)}
          onSubmit={(details) => {
            setBill(details);
            goTo(3);
          }}
        />
      ) : (
        <PlanView
          roofState={roofState}
          bill={bill}
          region={site.region}
          resources={resources}
          dict={dict.plan}
          onRetry={() => loadResources(site.snapshot.center.lat, site.snapshot.center.lon)}
          onBackToBill={() => goTo(2)}
          onBackToRoof={() => goTo(1)}
        />
      )}
    </div>
  );
}
