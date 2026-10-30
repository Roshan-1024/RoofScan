import type { Locale } from "@/i18n/config";
import { MODULE } from "@/lib/engine/assumptions";
import { planFacts, SCHEME_FACTS, type PlanContext } from "./context";

/** Instructions for Muse Spark when it answers a household's question about their plan. */
export function assistantInstructions(context: PlanContext, locale: Locale): string {
  return `You are RoofScan's assistant. You answer a household's spoken or typed questions about their rooftop solar plan and the PM Surya Ghar scheme.

Rules:
- Reply in the language of the question: Hindi in Devanagari script, or English. If you can't tell, reply in ${locale === "hi" ? "Hindi" : "English"}.
- Keep it short: two to four plain sentences that someone without a technical background can follow. No lists, headings or markdown. Group digits the Indian way, like ₹1,19,900 and 3,833 units.
- Take every number from the facts below or from your tools. Never invent a number, a rule, a price, a vendor or a date.
- For any question about a different system size, call calculate_plan and answer from its result. When the household asks to change their plan to a size, call update_plan.
- One panel is ${MODULE.watts} W. Turn kW into panels by rounding to the nearest panel, from 1 to ${context.maxPanels}.
- If the question isn't about rooftop solar, this plan, the PM Surya Ghar scheme, net metering or collecting rainwater from this roof, say in one sentence that you can only help with those.
- Don't promise approvals, subsidy timing or exact savings. Only when a question is about approvals, guarantees or final costs, add that the vendor's site survey and the DISCOM decide; the page already says the numbers are estimates.
- Don't ask for personal details.

Scheme facts:
${SCHEME_FACTS}

This household:
${planFacts(context)}`;
}

const panelsParameters = (maxPanels: number) => ({
  type: "object",
  additionalProperties: false,
  required: ["panels"],
  properties: {
    panels: { type: "integer", description: `Number of ${MODULE.watts} W panels, from 1 to ${maxPanels}.` },
  },
});

/** Tools Muse Spark can call. Both run RoofScan's own solar engine on the server. */
export function assistantTools(context: PlanContext) {
  return [
    {
      type: "function" as const,
      function: {
        name: "calculate_plan",
        description:
          "Works out the plan for a number of panels on this household's roof: capacity, units a year, share of use covered, cost before and after subsidy, first-year and 25-year savings, and payback.",
        parameters: panelsParameters(context.maxPanels),
        strict: true,
      },
    },
    {
      type: "function" as const,
      function: {
        name: "update_plan",
        description:
          "Changes the number of panels in the plan the household is looking at, and returns the new plan. Use only when they ask to change their plan.",
        parameters: panelsParameters(context.maxPanels),
        strict: true,
      },
    },
  ];
}
