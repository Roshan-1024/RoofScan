"use client";

import { useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import type { RoofSnapshot } from "@/lib/imagery/esri";
import type { Region } from "./types";
import { FindHouse } from "./find-house";
import { RoofEditor } from "./roof-editor";

interface SelectedSite {
  snapshot: RoofSnapshot;
  region?: Region;
}

export function CheckFlow({ locale, dict }: { locale: Locale; dict: Dictionary["check"] }) {
  const [site, setSite] = useState<SelectedSite | null>(null);
  const steps = [dict.steps.find, dict.steps.roof];
  const current = site ? 1 : 0;

  return (
    <div className="mt-6">
      <ol className="mb-6 flex flex-wrap gap-2 text-sm" aria-label={dict.title}>
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === current ? "step" : undefined}
            className={`rounded-full px-3 py-1 font-medium ${
              index === current ? "bg-primary text-primary-ink" : "bg-surface-muted text-muted"
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {site ? (
        <RoofEditor
          snapshot={site.snapshot}
          region={site.region}
          dict={dict.roof}
          onBack={() => setSite(null)}
        />
      ) : (
        <FindHouse locale={locale} dict={dict.find} onSelected={setSite} />
      )}
    </div>
  );
}
