import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/config";
import { askAboutPlan } from "@/lib/meta/ask";
import { planContextSchema, planFor } from "./context";

/**
 * Asks Muse Spark real questions about the Pune example plan and checks the
 * answers: language, numbers from RoofScan's engine, tool use, and staying
 * on topic. Prints every answer for reading. Run with `npm run eval:assistant`.
 */
const context = planContextSchema.parse(
  JSON.parse(readFileSync(new URL("./__fixtures__/pune-plan.json", import.meta.url), "utf8")),
);
// Muse Spark 1.3 standard prices, US$ per million tokens.
const INPUT_PRICE = 1.25;
const OUTPUT_PRICE = 4.25;

const devanagari = /[ऀ-ॿ]/;
/** Digits as the answer might write them: 63,240 / 63240 / ₹63,240. */
const mentions = (answer: string, value: number) => {
  const plain = answer.replace(/[,\s]/g, "");
  return plain.includes(String(Math.round(value)));
};

interface Case {
  locale: Locale;
  question: string;
  check: (answer: string, actions: { type: string; panels: number }[]) => string[];
}

const current = planFor(context);
const sixPanels = planFor(context, 6);
const cases: Case[] = [
  {
    locale: "en",
    question: "How long will it take for the system to pay for itself?",
    check: (answer) => [
      ...(devanagari.test(answer) ? ["answered in Hindi"] : []),
      ...(/2\.5|2½|two and a half/i.test(answer) ? [] : ["payback of 2.5 years missing"]),
    ],
  },
  {
    locale: "hi",
    question: "अगर मैं 3 किलोवाट का सिस्टम लगाऊँ तो कितनी सब्सिडी मिलेगी और मेरी लागत कितनी होगी?",
    check: (answer) => [
      ...(devanagari.test(answer) ? [] : ["not in Hindi"]),
      ...(mentions(answer, sixPanels.subsidy) ? [] : [`subsidy ${sixPanels.subsidy} missing`]),
      ...(mentions(answer, sixPanels.netCost) ? [] : [`net cost ${sixPanels.netCost} missing`]),
    ],
  },
  {
    locale: "en",
    question: "Please change my plan to 6 panels.",
    check: (answer, actions) => [
      ...(actions.some((action) => action.type === "setPanels" && action.panels === 6) ? [] : ["no setPanels 6 action"]),
    ],
  },
  {
    locale: "hi",
    question: "Mujhe kitni subsidy milegi?",
    check: (answer) => [...(mentions(answer, current.subsidy) ? [] : [`subsidy ${current.subsidy} missing`])],
  },
  {
    locale: "hi",
    question: "सब्सिडी का पैसा कैसे और कहाँ मिलेगा?",
    check: (answer) => [
      ...(devanagari.test(answer) ? [] : ["not in Hindi"]),
      ...(/बैंक|bank/i.test(answer) ? [] : ["bank account not mentioned"]),
    ],
  },
  {
    locale: "en",
    question: "How much rainwater can my roof collect?",
    check: (answer) => [...(/litre|liter/i.test(answer) ? [] : ["litres not mentioned"])],
  },
  {
    locale: "en",
    question: "Who will win the cricket world cup this year?",
    check: (answer) => [...(/₹|\d{2,}/.test(answer) ? ["gave numbers off topic"] : [])],
  },
];

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the check below skips the evaluation.
}

describe.skipIf(!process.env.MODEL_API_KEY)("assistant answers (Muse Spark, real API)", () => {
  it("answers questions about the plan", async () => {
    const results = await Promise.all(
      cases.map(async (testCase) => {
        const started = Date.now();
        const reply = await askAboutPlan(testCase.question, context, testCase.locale);
        return { testCase, reply, seconds: (Date.now() - started) / 1000 };
      }),
    );

    let failures = 0;
    let costUsd = 0;
    for (const { testCase, reply, seconds } of results) {
      const problems = testCase.check(reply.answer, reply.actions);
      failures += problems.length ? 1 : 0;
      costUsd += (reply.usage.inputTokens * INPUT_PRICE + reply.usage.outputTokens * OUTPUT_PRICE) / 1e6;
      console.log(
        `\nQ (${testCase.locale}): ${testCase.question}\nA: ${reply.answer}\nactions: ${JSON.stringify(reply.actions)} · calls: ${reply.usage.calls} · ${seconds.toFixed(1)} s${
          problems.length ? `\nPROBLEMS: ${problems.join("; ")}` : ""
        }`,
      );
    }
    console.log(`\n${cases.length - failures}/${cases.length} answers passed their checks. Cost: $${costUsd.toFixed(4)}.`);
    expect(failures).toBe(0);
  });
});
