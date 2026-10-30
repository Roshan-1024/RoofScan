import "server-only";
import { z } from "zod";
import { META_API_BASE_URL, ModelUnavailableError, MODELS } from "./client";

/** Muse Voice Transcribe failed or returned something unusable. */
export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly upstreamStatus?: number,
  ) {
    super(message);
  }
}

/** Words households use about rooftop solar, to help recognition. */
const KEYWORDS = ["PM Surya Ghar", "subsidy", "solar", "kW", "net metering", "DISCOM", "panel", "सब्सिडी", "सोलर", "पैनल", "बिजली बिल"];

const responseSchema = z.object({ transcript: z.string() });

/**
 * Transcribes a short spoken question (mono 16-bit PCM WAV) with Muse Voice
 * Transcribe, biased towards Hindi and English.
 */
export async function transcribeQuestion(wav: Uint8Array): Promise<string> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new ModelUnavailableError("MODEL_API_KEY is not set");

  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          mode: "PUSH_TO_TALK",
          model: MODELS.transcription,
          audioEncoding: "WAV",
          languageBias: ["Hindi", "English"],
          keywords: KEYWORDS,
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("audio", new Blob([wav as Uint8Array<ArrayBuffer>], { type: "audio/wav" }), "question.wav");

  let response: Response;
  try {
    response = await fetch(`${META_API_BASE_URL}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new TranscriptionError(`Transcription request failed: ${(error as Error).message}`);
  }
  if (!response.ok) throw new TranscriptionError(`Transcription returned HTTP ${response.status}`, response.status);
  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new TranscriptionError("Unexpected transcription response");
  return parsed.data.transcript.trim();
}
