import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planSolar } from "@/lib/engine/solar";
import { planContextSchema, planFacts, planFor, SCHEME_FACTS, summarisePlan } from "./context";
import { assistantInstructions, assistantTools } from "./prompt";

const context = planContextSchema.parse(
  JSON.parse(readFileSync(new URL("./__fixtures__/pune-plan.json", import.meta.url), "utf8")),
);

describe("planFor", () => {
  it("matches the plan view for the same inputs", () => {
    const plan = planFor(context);
    expect(plan.panels).toBe(4);
    expect(plan.subsidy).toBe(63_240);
    expect(plan.netCost).toBe(56_660);
  });

  it("keeps any requested size within the roof", () => {
    expect(planFor(context, 100).panels).toBe(27);
    expect(planFor(context, 0).panels).toBe(1);
    expect(planFor(context, 5.6).panels).toBe(6);
  });
});

describe("summarisePlan", () => {
  it("rounds the plan for the assistant without changing it", () => {
    const plan = planFor(context, 6);
    const summary = summarisePlan(context, plan);
    expect(summary.capacityKw).toBe(3.27);
    expect(summary.subsidyRupees).toBe(78_000);
    expect(summary.costAfterSubsidyRupees).toBe(plan.netCost);
    expect(summary.mostPanelsThatFit).toBe(27);
  });
});

describe("planFacts", () => {
  it("states the household's numbers from RoofScan's engine", () => {
    const facts = planFacts(context);
    expect(facts).toContain("Maharashtra");
    expect(facts).toContain("at most 27 panels");
    expect(facts).toContain('"subsidyRupees":63240');
    expect(facts).toContain("litres a year");
    const recommended = planSolar({
      maxPanelsOnRoof: 27,
      monthlyGhi: context.monthlyGhi,
      annualConsumptionKwh: context.annualConsumptionKwh,
      tariffPerKwh: context.tariffPerKwh,
      subsidyCategory: "general",
    });
    expect(facts).toContain(`RoofScan's recommendation: ${recommended.panels} panels`);
  });

  it("says when the connection isn't eligible or rainfall is unknown", () => {
    const facts = planFacts({ ...context, residential: false, rainfallMm: null });
    expect(facts).toContain("not eligible for the PM Surya Ghar subsidy");
    expect(facts).toContain("rainfall for this place isn't known");
  });
});

describe("assistant instructions", () => {
  it("carry the scheme facts, the household's plan and the answer language", () => {
    const hindi = assistantInstructions(context, "hi");
    expect(hindi).toContain(SCHEME_FACTS);
    expect(hindi).toContain(planFacts(context));
    expect(hindi).toContain("reply in Hindi");
    expect(SCHEME_FACTS).toContain("₹30,000 per kW for the first 2 kW");
    expect(SCHEME_FACTS).toContain("31 March 2027");
  });

  it("offer tools limited to the panels that fit", () => {
    const tools = assistantTools(context);
    expect(tools.map((tool) => tool.function.name)).toEqual(["calculate_plan", "update_plan"]);
    expect(tools[0].function.parameters.properties.panels.description).toContain("from 1 to 27");
  });
});

describe("planContextSchema", () => {
  it("rejects a context with the wrong number of months", () => {
    expect(planContextSchema.safeParse({ ...context, monthlyGhi: [1, 2, 3] }).success).toBe(false);
  });
});
