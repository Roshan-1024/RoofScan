import type { NextRequest } from "next/server";
import { z } from "zod";
import { locales } from "@/i18n/config";
import { planContextSchema } from "@/lib/assistant/context";
import { readWavInfo, TRANSCRIBE_SAMPLE_RATE } from "@/lib/audio/wav";
import { askAboutPlan, AssistantError } from "@/lib/meta/ask";
import { modelBudget, ModelUnavailableError } from "@/lib/meta/client";
import { TranscriptionError, transcribeQuestion } from "@/lib/meta/transcribe";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/body";
import { clientKey, RateLimiter } from "@/lib/security/rate-limit";

/** Transcription plus a few rounds of Muse Spark with tools. */
export const maxDuration = 60;

/** A 45-second recording at 16 kHz is about 1.9 MB as base64. */
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 60;
const limiter = new RateLimiter(20, 10 * 60 * 1000);

const requestSchema = z
  .object({
    question: z.string().trim().min(2).max(500).optional(),
    /** A spoken question: mono 16-bit PCM WAV as a data URL. */
    audio: z
      .string()
      .regex(/^data:audio\/(?:wav|wave|x-wav);base64,[A-Za-z0-9+/]+={0,2}$/)
      .optional(),
    locale: z.enum(locales),
    context: planContextSchema,
  })
  .refine((body) => Boolean(body.question) !== Boolean(body.audio), {
    message: "send either question or audio",
  });

/**
 * POST /api/ask { question | audio, locale, context }: answers a household's
 * question about their plan. A spoken question is transcribed with Muse
 * Voice Transcribe first; Muse Spark answers from the plan, recalculating
 * it with RoofScan's engine when asked about another size. Returns
 * { question, answer, actions }. Nothing is stored.
 */
export async function POST(request: NextRequest) {
  if (!limiter.allow(clientKey(request))) {
    return Response.json({ error: "Too many questions. Try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return Response.json({ error: "The recording is too long" }, { status: 413 });
    return Response.json({ error: "The body must be JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Send a question or a WAV recording, the locale and the plan context" }, { status: 400 });
  }
  const { audio, locale, context } = parsed.data;

  let wav: Uint8Array | null = null;
  if (audio) {
    wav = new Uint8Array(Buffer.from(audio.slice(audio.indexOf(",") + 1), "base64"));
    const info = readWavInfo(wav);
    if (
      !info ||
      info.channels !== 1 ||
      info.bitsPerSample !== 16 ||
      (info.sampleRate !== TRANSCRIBE_SAMPLE_RATE && info.sampleRate !== 24_000)
    ) {
      return Response.json({ error: "Audio must be mono 16-bit PCM WAV at 16 or 24 kHz" }, { status: 400 });
    }
    if (info.durationSeconds > MAX_RECORDING_SECONDS) {
      return Response.json({ error: "The recording is too long" }, { status: 413 });
    }
  }
  if (!modelBudget.allow()) {
    return Response.json({ error: "Questions have reached today's limit" }, { status: 503 });
  }

  try {
    const question = wav ? await transcribeQuestion(wav) : parsed.data.question!;
    if (!question) return Response.json({ question: "", answer: null, actions: [] });
    const { answer, actions } = await askAboutPlan(question, context, locale);
    return Response.json({ question, answer, actions });
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      return Response.json({ error: "Questions are not available" }, { status: 503 });
    }
    if (error instanceof TranscriptionError || error instanceof AssistantError) {
      console.error(`ask: ${error.message}`);
      return Response.json({ error: "Answering failed" }, { status: 502 });
    }
    throw error;
  }
}
