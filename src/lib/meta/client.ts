import "server-only";
import OpenAI from "openai";
import { DailyCap } from "@/lib/security/rate-limit";

/** Meta's Model API speaks the OpenAI wire format, so the official SDK works with a different base URL. */
export const META_API_BASE_URL = "https://api.meta.ai/v1";

/**
 * Standard model IDs. The "-contributor" variants are cheaper because Meta
 * may use their requests to improve its products, so RoofScan avoids them.
 */
export const MODELS = {
  segmentation: "sam-3.1",
  language: "muse-spark-1.3",
  transcription: "muse-voice-transcribe-1.0",
} as const;

/** No API key is configured, so model features are switched off. */
export class ModelUnavailableError extends Error {}

let client: OpenAI | null = null;

export function modelClient(): OpenAI {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new ModelUnavailableError("MODEL_API_KEY is not set");
  client ??= new OpenAI({ apiKey, baseURL: META_API_BASE_URL, timeout: 30_000, maxRetries: 1 });
  return client;
}

/**
 * Model requests allowed per UTC day on one server instance, across every
 * visitor. Each one costs money, so this bounds the bill if traffic spikes.
 */
const DEFAULT_DAILY_LIMIT = 2000;
export const modelBudget = new DailyCap(Number(process.env.MODEL_DAILY_REQUEST_LIMIT) || DEFAULT_DAILY_LIMIT);
