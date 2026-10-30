import type { NextRequest } from "next/server";
import { z } from "zod";
import { modelBudget, ModelUnavailableError } from "@/lib/meta/client";
import { BillReadingError, readBill } from "@/lib/meta/read-bill";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/body";
import { clientKey, RateLimiter } from "@/lib/security/rate-limit";

/** Reading a bill usually takes a few seconds; PDFs and slow responses take longer. */
export const maxDuration = 60;

/** Photos are resized in the browser to well under 2 MB; e-bill PDFs are usually under 1 MB. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;
// Each request is a paid Muse Spark call. A household reads one bill, maybe retaking the photo.
const limiter = new RateLimiter(10, 10 * 60 * 1000);

const requestSchema = z.object({
  file: z.string().regex(/^data:(?:image\/(?:jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/),
});

/**
 * POST /api/bill/read { file }: reads an electricity bill photo or PDF with
 * Muse Spark and returns { isElectricityBill, prefill }, the values for the
 * bill form. The file goes to Meta's Model API for this request only and is
 * not stored; names and addresses are not read.
 */
export async function POST(request: NextRequest) {
  if (!limiter.allow(clientKey(request))) {
    return Response.json({ error: "Too many bill readings. Try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ error: "The file is too large" }, { status: 413 });
    }
    return Response.json({ error: "The body must be JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "file must be a JPEG, PNG, WebP or PDF data URL" }, { status: 400 });
  }
  if (!modelBudget.allow()) {
    return Response.json({ error: "Bill reading has reached today's limit" }, { status: 503 });
  }

  try {
    const reading = await readBill(parsed.data.file);
    return Response.json({ isElectricityBill: reading.extraction.isElectricityBill, prefill: reading.prefill });
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      return Response.json({ error: "Bill reading is not available" }, { status: 503 });
    }
    if (error instanceof BillReadingError) {
      console.error(`bill reading: ${error.message}`);
      return Response.json({ error: "Bill reading failed" }, { status: 502 });
    }
    throw error;
  }
}
