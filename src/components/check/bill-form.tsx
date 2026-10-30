"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type { Dictionary } from "@/i18n";
import { billSchema, isUnusualTariff, tariffPerKwh, type BillDetails } from "@/lib/bill";
import type { BillPrefill } from "@/lib/bill-reading/extract";
import { BillFileError, prepareBillFile } from "@/lib/bill-reading/file";
import { fill, formatRupees } from "@/lib/format";

type Field =
  | "unitsOnBill"
  | "billingMonths"
  | "amountRupees"
  | "fixedChargesRupees"
  | "sanctionedLoadKw"
  | "residential"
  | "discom"
  | "consumerNumber"
  | "householdSize"
  | "priorSubsidisedKw";

type Values = Record<Field, string>;

/** Progress of reading a bill photo or PDF with Muse Spark. */
type ReadState =
  | { status: "idle" | "reading" | "notBill" | "nothing" | "error" | "busy" | "tooLarge" | "unsupported" }
  | { status: "filled"; count: number };

/** The form's text for each value a reading can fill in. */
function prefillValues(prefill: BillPrefill): Partial<Values> {
  const values: Partial<Values> = {};
  if (prefill.unitsOnBill !== undefined) values.unitsOnBill = String(prefill.unitsOnBill);
  if (prefill.billingMonths !== undefined) values.billingMonths = String(prefill.billingMonths);
  if (prefill.amountRupees !== undefined) values.amountRupees = String(prefill.amountRupees);
  if (prefill.fixedChargesRupees !== undefined) values.fixedChargesRupees = String(prefill.fixedChargesRupees);
  if (prefill.sanctionedLoadKw !== undefined) values.sanctionedLoadKw = String(prefill.sanctionedLoadKw);
  if (prefill.residential !== undefined) values.residential = prefill.residential ? "yes" : "no";
  if (prefill.discom !== undefined) values.discom = prefill.discom;
  if (prefill.consumerNumber !== undefined) values.consumerNumber = prefill.consumerNumber;
  return values;
}

const ERROR_KEYS: Partial<Record<Field, keyof Dictionary["check"]["bill"]["errors"]>> = {
  unitsOnBill: "units",
  amountRupees: "amount",
  fixedChargesRupees: "fixed",
  sanctionedLoadKw: "sanctionedLoad",
  householdSize: "household",
  priorSubsidisedKw: "priorSolar",
};

function toValues(bill?: BillDetails): Values {
  return {
    unitsOnBill: bill ? String(bill.unitsOnBill) : "",
    billingMonths: bill ? String(bill.billingMonths) : "1",
    amountRupees: bill ? String(bill.amountRupees) : "",
    fixedChargesRupees: bill?.fixedChargesRupees !== undefined ? String(bill.fixedChargesRupees) : "",
    sanctionedLoadKw: bill?.sanctionedLoadKw !== undefined ? String(bill.sanctionedLoadKw) : "",
    residential: bill && !bill.residential ? "no" : "yes",
    discom: bill?.discom ?? "",
    consumerNumber: bill?.consumerNumber ?? "",
    householdSize: bill ? String(bill.householdSize) : "4",
    priorSubsidisedKw: bill?.priorSubsidisedKw !== undefined ? String(bill.priorSubsidisedKw) : "",
  };
}

const optionalNumber = (value: string) => (value.trim() === "" ? undefined : Number(value.replace(/,/g, "")));
const optionalText = (value: string) => (value.trim() === "" ? undefined : value.trim());

function toCandidate(values: Values) {
  return {
    unitsOnBill: Number(values.unitsOnBill.replace(/,/g, "")),
    billingMonths: Number(values.billingMonths),
    amountRupees: Number(values.amountRupees.replace(/,/g, "")),
    fixedChargesRupees: optionalNumber(values.fixedChargesRupees),
    sanctionedLoadKw: optionalNumber(values.sanctionedLoadKw),
    residential: values.residential === "yes",
    discom: optionalText(values.discom),
    consumerNumber: optionalText(values.consumerNumber),
    householdSize: Number(values.householdSize),
    priorSubsidisedKw: optionalNumber(values.priorSubsidisedKw),
  };
}

function TextField({
  label,
  hint,
  error,
  badge,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Marks a value read from the bill, until the household edits it. */
  badge?: string;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const badgeId = `${id}-badge`;
  const describedBy = [hint ? hintId : "", error ? errorId : "", badge ? badgeId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex flex-wrap items-center gap-2 font-medium">
        {label}
        {badge && (
          <span id={badgeId} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
            {badge}
          </span>
        )}
      </label>
      {children({ id, describedBy })}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-border bg-surface px-4 py-3";

export function BillForm({
  initial,
  dict,
  onSubmit,
  onBack,
}: {
  initial?: BillDetails;
  dict: Dictionary["check"]["bill"];
  onSubmit: (bill: BillDetails) => void;
  onBack: () => void;
}) {
  const [values, setValues] = useState<Values>(() => toValues(initial));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [read, setRead] = useState<ReadState>({ status: "idle" });
  // Fields filled from the bill and not edited since.
  const [fromBill, setFromBill] = useState<ReadonlySet<Field>>(new Set());
  const latestRead = useRef(0);
  const readDict = dict.read;

  const set = (field: Field) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setFromBill((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };
  const badge = (field: Field) => (fromBill.has(field) ? readDict.fromBill : undefined);

  async function readBillFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be chosen again after a failure.
    event.target.value = "";
    if (!file) return;
    const request = ++latestRead.current;
    setRead({ status: "reading" });
    try {
      const dataUrl = await prepareBillFile(file);
      const response = await fetch("/api/bill/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: dataUrl }),
      });
      if (request !== latestRead.current) return;
      if (response.status === 429) return setRead({ status: "busy" });
      if (response.status === 413) return setRead({ status: "tooLarge" });
      if (!response.ok) throw new Error(`Bill reading returned ${response.status}`);
      const reading = (await response.json()) as { isElectricityBill: boolean; prefill: BillPrefill };
      if (request !== latestRead.current) return;
      if (!reading.isElectricityBill) return setRead({ status: "notBill" });
      const filled = prefillValues(reading.prefill);
      const fields = Object.keys(filled) as Field[];
      if (fields.length === 0) return setRead({ status: "nothing" });
      setValues((current) => ({ ...current, ...filled }));
      setFromBill(new Set(fields));
      setErrors({});
      setRead({ status: "filled", count: fields.length });
    } catch (error) {
      if (request !== latestRead.current) return;
      setRead({ status: error instanceof BillFileError ? error.reason : "error" });
    }
  }

  const readMessage = {
    idle: null,
    reading: readDict.reading,
    filled: read.status === "filled" ? fill(readDict.filled, { count: read.count }) : null,
    notBill: readDict.notBill,
    nothing: readDict.nothing,
    error: readDict.error,
    busy: readDict.busy,
    tooLarge: readDict.tooLarge,
    unsupported: readDict.unsupported,
  }[read.status];
  const readFileId = useId();

  const preview = billSchema.safeParse(toCandidate(values));
  const tariff = preview.success ? tariffPerKwh(preview.data) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = billSchema.safeParse(toCandidate(values));
    if (result.success) {
      setErrors({});
      onSubmit(result.data);
      return;
    }
    const next: Partial<Record<Field, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as Field;
      const key = ERROR_KEYS[field];
      if (key && !next[field]) next[field] = dict.errors[key];
    }
    setErrors(next);
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-5">
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5" aria-labelledby={`${readFileId}-title`}>
        <h2 id={`${readFileId}-title`} className="text-lg font-semibold">
          {readDict.title}
        </h2>
        <p className="text-muted">{readDict.intro}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`cursor-pointer rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-ink ${
              read.status === "reading" ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {read.status === "reading" ? readDict.reading : readDict.choose}
            <input
              id={readFileId}
              type="file"
              accept="image/*,application/pdf"
              onChange={readBillFile}
              disabled={read.status === "reading"}
              className="sr-only"
            />
          </label>
        </div>
        <p className="text-xs text-muted">{readDict.privacy}</p>
        <div aria-live="polite">
          {readMessage && read.status !== "reading" && (
            <p
              className={`rounded-xl p-3 text-sm ${
                read.status === "filled" ? "bg-primary-soft" : "bg-surface-muted text-danger"
              }`}
            >
              {readMessage}
            </p>
          )}
        </div>
      </section>

      <p className="text-muted">{dict.intro}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label={dict.units} hint={dict.unitsHint} error={errors.unitsOnBill} badge={badge("unitsOnBill")}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.unitsOnBill} onChange={set("unitsOnBill")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.months} badge={badge("billingMonths")}>
          {({ id }) => (
            <select id={id} value={values.billingMonths} onChange={set("billingMonths")} className={inputClass}>
              {dict.monthOptions.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </TextField>
        <TextField label={dict.amount} hint={dict.amountHint} error={errors.amountRupees} badge={badge("amountRupees")}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.amountRupees} onChange={set("amountRupees")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.fixed} hint={dict.fixedHint} error={errors.fixedChargesRupees} badge={badge("fixedChargesRupees")}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.fixedChargesRupees} onChange={set("fixedChargesRupees")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.sanctionedLoad} error={errors.sanctionedLoadKw} badge={badge("sanctionedLoadKw")}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.sanctionedLoadKw} onChange={set("sanctionedLoadKw")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.connection} badge={badge("residential")}>
          {({ id }) => (
            <select id={id} value={values.residential} onChange={set("residential")} className={inputClass}>
              <option value="yes">{dict.residential}</option>
              <option value="no">{dict.other}</option>
            </select>
          )}
        </TextField>
        <TextField label={dict.discom} badge={badge("discom")}>
          {({ id }) => <input id={id} value={values.discom} onChange={set("discom")} className={inputClass} />}
        </TextField>
        <TextField label={dict.consumerNumber} hint={dict.consumerNumberHint} badge={badge("consumerNumber")}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} value={values.consumerNumber} onChange={set("consumerNumber")} autoComplete="off" className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.household} error={errors.householdSize}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="numeric" value={values.householdSize} onChange={set("householdSize")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.priorSolar} hint={dict.priorSolarHint} error={errors.priorSubsidisedKw}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.priorSubsidisedKw} onChange={set("priorSubsidisedKw")} className={inputClass} />
          )}
        </TextField>
      </div>

      {tariff !== null && isUnusualTariff(tariff) && (
        <p role="status" className="rounded-xl bg-primary-soft p-3 text-sm">
          {fill(dict.unusualTariff, { value: formatRupees(tariff) })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-ink">
          {dict.continue}
        </button>
        <button type="button" onClick={onBack} className="text-sm font-medium text-primary underline">
          {dict.back}
        </button>
      </div>
    </form>
  );
}
