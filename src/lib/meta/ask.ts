import "server-only";
import { APIError } from "openai";
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { planFor, summarisePlan, type PlanContext } from "@/lib/assistant/context";
import { assistantInstructions, assistantTools } from "@/lib/assistant/prompt";
import { modelClient, ModelUnavailableError, MODELS } from "./client";

/** Muse Spark failed, or never settled on an answer. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly upstreamStatus?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** A change the household asked for, applied to the plan on their screen. */
export type PlanAction = { type: "setPanels"; panels: number };

export interface AssistantAnswer {
  answer: string;
  actions: PlanAction[];
  usage: { inputTokens: number; outputTokens: number; calls: number };
}

/** Tool rounds before Muse Spark must answer with what it has. */
const MAX_TOOL_ROUNDS = 3;
const toolArguments = z.object({ panels: z.number() });

function runTool(call: ChatCompletionMessageToolCall, context: PlanContext, actions: PlanAction[]): object {
  if (call.type !== "function") return { error: "Unknown tool" };
  let panels: number;
  try {
    panels = toolArguments.parse(JSON.parse(call.function.arguments)).panels;
  } catch {
    return { error: "panels must be a number" };
  }
  const plan = planFor(context, panels);
  const summary = summarisePlan(context, plan);
  switch (call.function.name) {
    case "calculate_plan":
      return summary;
    case "update_plan":
      actions.push({ type: "setPanels", panels: plan.panels });
      return { updated: true, ...summary };
    default:
      return { error: `Unknown tool ${call.function.name}` };
  }
}

/**
 * Answers a question about the household's plan with Muse Spark. Numbers
 * come from RoofScan's engine: the plan facts in the instructions, and
 * tools that recalculate the plan for another size or change it.
 */
export async function askAboutPlan(question: string, context: PlanContext, locale: Locale): Promise<AssistantAnswer> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: assistantInstructions(context, locale) },
    { role: "user", content: question },
  ];
  const tools = assistantTools(context);
  const actions: PlanAction[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, calls: 0 };

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const completion = await modelClient().chat.completions.create({
        model: MODELS.language,
        reasoning_effort: "low",
        max_tokens: 2000,
        messages,
        // The last round offers no tools, so Muse Spark answers.
        ...(round < MAX_TOOL_ROUNDS ? { tools, parallel_tool_calls: false } : {}),
      });
      usage.calls++;
      usage.inputTokens += completion.usage?.prompt_tokens ?? 0;
      usage.outputTokens += completion.usage?.completion_tokens ?? 0;

      const message = completion.choices[0]?.message;
      if (!message) throw new AssistantError("Muse Spark returned no message");
      if (!message.tool_calls?.length) {
        const answer = message.content?.trim();
        if (!answer) throw new AssistantError("Muse Spark returned an empty answer");
        return { answer, actions, usage };
      }
      // The API needs the assistant's tool calls echoed before their results.
      messages.push(message);
      for (const call of message.tool_calls) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(runTool(call, context, actions)) });
      }
    }
    throw new AssistantError("Muse Spark kept calling tools without answering");
  } catch (error) {
    if (error instanceof ModelUnavailableError || error instanceof AssistantError) throw error;
    if (error instanceof APIError) {
      throw new AssistantError(`Assistant request failed (${error.status ?? "no response"})`, error.status, { cause: error });
    }
    throw error;
  }
}
