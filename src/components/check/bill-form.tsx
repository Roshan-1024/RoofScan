"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { Dictionary } from "@/i18n";
import { billSchema, isUnusualTariff, tariffPerKwh, type BillDetails } from "@/lib/bill";
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
  | "householdSize";

type Values = Record<Field, string>;

const ERROR_KEYS: Partial<Record<Field, keyof Dictionary["check"]["bill"]["errors"]>> = {
  unitsOnBill: "units",
  amountRupees: "amount",
  fixedChargesRupees: "fixed",
  sanctionedLoadKw: "sanctionedLoad",
  householdSize: "household",
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
  };
}

function TextField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-medium">
        {label}
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

  const set = (field: Field) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

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
      <p className="text-muted">{dict.intro}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label={dict.units} hint={dict.unitsHint} error={errors.unitsOnBill}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.unitsOnBill} onChange={set("unitsOnBill")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.months}>
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
        <TextField label={dict.amount} hint={dict.amountHint} error={errors.amountRupees}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.amountRupees} onChange={set("amountRupees")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.fixed} hint={dict.fixedHint} error={errors.fixedChargesRupees}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.fixedChargesRupees} onChange={set("fixedChargesRupees")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.sanctionedLoad} error={errors.sanctionedLoadKw}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.sanctionedLoadKw} onChange={set("sanctionedLoadKw")} className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.connection}>
          {({ id }) => (
            <select id={id} value={values.residential} onChange={set("residential")} className={inputClass}>
              <option value="yes">{dict.residential}</option>
              <option value="no">{dict.other}</option>
            </select>
          )}
        </TextField>
        <TextField label={dict.discom}>
          {({ id }) => <input id={id} value={values.discom} onChange={set("discom")} className={inputClass} />}
        </TextField>
        <TextField label={dict.consumerNumber} hint={dict.consumerNumberHint}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} value={values.consumerNumber} onChange={set("consumerNumber")} autoComplete="off" className={inputClass} />
          )}
        </TextField>
        <TextField label={dict.household} error={errors.householdSize}>
          {({ id, describedBy }) => (
            <input id={id} aria-describedby={describedBy} inputMode="numeric" value={values.householdSize} onChange={set("householdSize")} className={inputClass} />
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
