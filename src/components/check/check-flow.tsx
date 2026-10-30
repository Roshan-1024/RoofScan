"use client";

import { useEffect, useState } from "react";
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

interface Progress {
  step: Step;
  site: SelectedSite | null;
  roofState: RoofState | null;
  bill: BillDetails | null;
}

/**
 * Progress lives in sessionStorage: it survives a reload, stays in this tab
 * only, and is cleared when the tab closes. Nothing is sent to a server.
 */
const STORAGE_KEY = "roofscan:check:v1";
const EMPTY: Progress = { step: 0, site: null, roofState: null, bill: null };

function readProgress(): Progress {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Progress | null;
    if (saved && typeof saved.step === "number" && saved.step >= 0 && saved.step <= 3) return saved;
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return EMPTY;
}

function saveProgress(progress: Progress) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or blocked: progress just won't survive a reload.
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

function fetchResources(lat: number, lon: number): Promise<SiteResources> {
  const query = `lat=${lat}&lon=${lon}`;
  return Promise.all([
    getJson<{ monthlyGhi: number[] }>(`/api/solar-resource?${query}`),
    // Rainfall is optional: the household can type it in if the lookup fails.
    getJson<RainfallData>(`/api/rainfall?${query}`).catch(() => null),
  ])
    .then(([solar, rainfall]): SiteResources => ({ status: "ready", monthlyGhi: solar.monthlyGhi, rainfall }))
    .catch((): SiteResources => ({ status: "error" }));
}

/** Rendered on the client only (see CheckFlowLoader), so it can read sessionStorage while initialising. */
export function CheckFlow({
  locale,
  dict,
  disclaimer,
}: {
  locale: Locale;
  dict: Dictionary["check"];
  disclaimer: string;
}) {
  const [initial] = useState(readProgress);
  const [step, setStep] = useState<Step>(initial.step);
  const [site, setSite] = useState<SelectedSite | null>(initial.site);
  const [roofState, setRoofState] = useState<RoofState | null>(initial.roofState);
  const [bill, setBill] = useState<BillDetails | null>(initial.bill);
  const [resources, setResources] = useState<SiteResources>({ status: "loading" });

  // A restored session needs its location data again.
  useEffect(() => {
    if (!initial.site) return;
    let cancelled = false;
    fetchResources(initial.site.snapshot.center.lat, initial.site.snapshot.center.lon).then((loaded) => {
      if (!cancelled) setResources(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [initial.site]);

  useEffect(() => {
    saveProgress({ step, site, roofState, bill });
  }, [step, site, roofState, bill]);

  const steps = [dict.steps.find, dict.steps.roof, dict.steps.bill, dict.steps.plan];

  function goTo(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadResources(lat: number, lon: number) {
    setResources({ status: "loading" });
    fetchResources(lat, lon).then(setResources);
  }

  function handleSelected(selected: SelectedSite) {
    setSite(selected);
    setRoofState(null);
    loadResources(selected.snapshot.center.lat, selected.snapshot.center.lon);
    goTo(1);
  }

  function startOver() {
    setSite(null);
    setRoofState(null);
    setBill(null);
    goTo(0);
  }

  return (
    <div className="mt-6">
      <ol className="mb-6 flex flex-wrap gap-2 text-sm print:hidden" aria-label={dict.title}>
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
          locale={locale}
          snapshot={site.snapshot}
          roofState={roofState}
          bill={bill}
          region={site.region}
          resources={resources}
          checkDict={dict}
          disclaimer={disclaimer}
          onRetry={() => loadResources(site.snapshot.center.lat, site.snapshot.center.lon)}
          onBackToBill={() => goTo(2)}
          onBackToRoof={() => goTo(1)}
          onStartOver={startOver}
        />
      )}
    </div>
  );
}
