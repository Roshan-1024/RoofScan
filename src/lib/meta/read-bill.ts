import "server-only";
import { APIError } from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import {
  BILL_EXTRACTION_JSON_SCHEMA,
  BILL_READING_INSTRUCTIONS,
  billExtractionSchema,
  toBillPrefill,
  type BillExtraction,
  type BillPrefill,
} from "@/lib/bill-reading/extract";
import { modelClient, ModelUnavailableError, MODELS } from "./client";

/** Muse Spark failed, or its answer couldn't be used. */
export class BillReadingError extends Error {
  constructor(
    message: string,
    /** HTTP status from the Model API, when the request itself failed. */
    readonly upstreamStatus?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export interface BillReading {
  extraction: BillExtraction;
  /** Values for the bill form, checked for consistency. */
  prefill: BillPrefill;
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number } | null;
}

/**
 * Low effort is enough to copy numbers off a bill, and keeps a reading to a
 * few seconds. The output cap covers reasoning as well as the JSON.
 */
const REASONING_EFFORT = "low";
const MAX_OUTPUT_TOKENS = 4000;

/** Reads an electricity bill, given as a data URL of a photo (JPEG, PNG or WebP) or a PDF. */
export async function readBill(dataUrl: string): Promise<BillReading> {
  const bill: ChatCompletionContentPart = dataUrl.startsWith("data:application/pdf")
    ? { type: "file", file: { filename: "bill.pdf", file_data: dataUrl } }
    : { type: "image_url", image_url: { url: dataUrl } };

  try {
    const completion = await modelClient().chat.completions.create({
      model: MODELS.language,
      reasoning_effort: REASONING_EFFORT,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: {
        type: "json_schema",
        json_schema: { name: "electricity_bill", strict: true, schema: BILL_EXTRACTION_JSON_SCHEMA },
      },
      messages: [
        { role: "system", content: BILL_READING_INSTRUCTIONS },
        { role: "user", content: [{ type: "text", text: "Read this electricity bill." }, bill] },
      ],
    });

    const choice = completion.choices[0];
    if (!choice || choice.finish_reason === "length") {
      throw new BillReadingError(`Muse Spark stopped early (${choice?.finish_reason ?? "no answer"})`);
    }
    const parsed = billExtractionSchema.safeParse(JSON.parse(choice.message.content ?? ""));
    if (!parsed.success) throw new BillReadingError("Muse Spark's answer didn't match the bill schema");

    const usage = completion.usage;
    return {
      extraction: parsed.data,
      prefill: toBillPrefill(parsed.data),
      usage: usage
        ? {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
          }
        : null,
    };
  } catch (error) {
    if (error instanceof ModelUnavailableError || error instanceof BillReadingError) throw error;
    if (error instanceof APIError) {
      throw new BillReadingError(`Bill reading request failed (${error.status ?? "no response"})`, error.status, {
        cause: error,
      });
    }
    if (error instanceof SyntaxError) throw new BillReadingError("Muse Spark's answer wasn't JSON", undefined, { cause: error });
    throw error;
  }
}
