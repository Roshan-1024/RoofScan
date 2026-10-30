import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readBill } from "@/lib/meta/read-bill";

/**
 * Reads every synthetic bill in __fixtures__ with Muse Spark and compares
 * the form values with what each bill really says. Prints a table of
 * results, tokens and cost, and fails if accuracy drops below the bar.
 */
const FIXTURES = new URL("./__fixtures__/", import.meta.url).pathname;
// Muse Spark 1.3 standard prices, US$ per million tokens.
const INPUT_PRICE = 1.25;
const OUTPUT_PRICE = 4.25;

interface Expected {
  isElectricityBill: boolean;
  units?: number;
  months?: number;
  amount?: number;
  fixed?: number;
  loadKw?: number;
  residential?: boolean;
  consumer?: string;
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", pdf: "application/pdf" };
const close = (a: number | undefined, b: number | undefined) => a !== undefined && b !== undefined && Math.abs(a - b) <= 0.01 * Math.max(1, b);

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the check below skips the evaluation.
}

describe.skipIf(!process.env.MODEL_API_KEY)("bill reading accuracy (Muse Spark, real API)", () => {
  it("reads the synthetic bills", async () => {
    const { cases } = JSON.parse(readFileSync(`${FIXTURES}expected.json`, "utf8")) as {
      cases: { file: string; expected: Expected }[];
    };
    expect(cases.length).toBe(readdirSync(FIXTURES).filter((name) => name !== "expected.json" && name !== "README.md").length);

    const rows: string[] = [];
    let checks = 0;
    let correct = 0;
    let classified = 0;
    let costUsd = 0;

    const results = await Promise.all(
      cases.map(async ({ file, expected }) => {
        const extension = file.split(".").pop()!;
        const dataUrl = `data:${MIME[extension]};base64,${readFileSync(FIXTURES + file).toString("base64")}`;
        const started = Date.now();
        const reading = await readBill(dataUrl);
        return { file, expected, reading, seconds: (Date.now() - started) / 1000 };
      }),
    );

    for (const { file, expected, reading, seconds } of results) {
      const { prefill, extraction, usage } = reading;
      if (usage) costUsd += (usage.inputTokens * INPUT_PRICE + usage.outputTokens * OUTPUT_PRICE) / 1e6;
      if (extraction.isElectricityBill === expected.isElectricityBill) classified++;

      const fields: [string, boolean][] = expected.isElectricityBill
        ? [
            ["units", close(prefill.unitsOnBill, expected.units)],
            ["months", prefill.billingMonths === expected.months],
            ["amount", close(prefill.amountRupees, expected.amount)],
            ["fixed", close(prefill.fixedChargesRupees, expected.fixed)],
            ["load", close(prefill.sanctionedLoadKw, expected.loadKw)],
            ["residential", prefill.residential === expected.residential],
            ["consumer", prefill.consumerNumber?.replace(/\s/g, "") === expected.consumer],
          ]
        : [];
      checks += fields.length;
      correct += fields.filter(([, ok]) => ok).length;
      const misses = fields.filter(([, ok]) => !ok).map(([name]) => name);
      rows.push(
        `| ${file} | ${extraction.isElectricityBill === expected.isElectricityBill ? "yes" : "NO"} | ${
          fields.length ? `${fields.length - misses.length}/${fields.length}` : "-"
        } | ${misses.join(", ") || "-"} | ${usage ? `${usage.inputTokens}/${usage.outputTokens}` : "?"} | ${seconds.toFixed(1)} s |`,
      );
      if (misses.length) console.log(file, JSON.stringify(prefill), JSON.stringify(extraction));
    }

    console.log(
      [
        "| Bill | Classified | Fields right | Missed | Tokens in/out | Time |",
        "|---|---|---|---|---|---|",
        ...rows,
        "",
        `Fields: ${correct}/${checks} (${((100 * correct) / checks).toFixed(1)}%). Classified: ${classified}/${cases.length}. Cost: $${costUsd.toFixed(4)}.`,
      ].join("\n"),
    );

    expect(classified).toBe(cases.length);
    expect(correct / checks).toBeGreaterThanOrEqual(0.9);
  });
});
