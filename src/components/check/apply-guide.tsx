import type { Dictionary } from "@/i18n";
import { maskConsumerNumber, type BillDetails } from "@/lib/bill";
import { formatNumber } from "@/lib/format";
import type { Region } from "./types";

export const PM_SURYA_GHAR_PORTAL = "https://pmsuryaghar.gov.in";

/** Application details and the official steps, for the screen and the printed report. */
export function ApplyGuide({
  dict,
  capacityKw,
  bill,
  region,
  showPortalLink = true,
}: {
  dict: Dictionary["check"]["apply"];
  capacityKw: number;
  bill: BillDetails;
  region?: Region;
  showPortalLink?: boolean;
}) {
  const details: Array<[string, string]> = [
    [dict.state, region?.state ?? dict.notEntered],
    [dict.discom, bill.discom ?? dict.notEntered],
    [dict.consumerNumber, bill.consumerNumber ? maskConsumerNumber(bill.consumerNumber) : dict.notEntered],
    [dict.capacity, `${formatNumber(capacityKw, 2)} kW`],
    [dict.sanctionedLoad, bill.sanctionedLoadKw !== undefined ? `${formatNumber(bill.sanctionedLoadKw, 2)} kW` : dict.notEntered],
  ];

  return (
    <div className="space-y-5">
      <p className="text-muted">{dict.intro}</p>
      {showPortalLink && (
        <a
          href={PM_SURYA_GHAR_PORTAL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-ink"
        >
          {dict.portal} ↗
        </a>
      )}

      <div>
        <h3 className="font-semibold">{dict.detailsTitle}</h3>
        <dl className="mt-2 divide-y divide-border rounded-xl border border-border">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-2">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h3 className="font-semibold">{dict.stepsTitle}</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          {dict.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="font-semibold">{dict.documentsTitle}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {dict.documents.map((document) => (
            <li key={document}>{document}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
