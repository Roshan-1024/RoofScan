import type { NextRequest } from "next/server";
import { z } from "zod";
import { modelBudget, ModelUnavailableError } from "@/lib/meta/client";
import { outlineObjectAt, SegmentationError } from "@/lib/meta/sam";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/body";
import { clientKey, RateLimiter } from "@/lib/security/rate-limit";

/** SAM usually answers in 1 to 3 seconds; this leaves room for a slow response and a cold start. */
export const maxDuration = 30;

/** An 800 px uploaded photo is well under 1 MB as a data URL; satellite snapshots are about 60 kB. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
// Each request is a paid SAM call. Retrying a few spots is normal; dozens is not.
const limiter = new RateLimiter(15, 10 * 60 * 1000);

const requestSchema = z
  .object({
    image: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
    /** Width and height of the square image, in pixels. */
    size: z.number().int().min(64).max(1024),
    point: z.object({ x: z.number().min(0), y: z.number().min(0) }),
  })
  .refine(({ size, point }) => point.x < size && point.y < size, {
    path: ["point"],
    message: "point must be inside the image",
  });

/**
 * POST /api/roof/outline { image, size, point }: outlines the roof under
 * `point` in a square roof image with Meta SAM 3.1 and returns
 * { outline: { polygon, confidence } }, or { outline: null } when there is
 * no roof shape at that spot. The image goes to Meta's Model API for this
 * request only and is not stored.
 */
export async function POST(request: NextRequest) {
  if (!limiter.allow(clientKey(request))) {
    return Response.json({ error: "Too many outline requests. Try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ error: "The image is too large" }, { status: 413 });
    }
    return Response.json({ error: "The body must be JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "image (a data URL), size and point are required" }, { status: 400 });
  }
  if (!modelBudget.allow()) {
    return Response.json({ error: "Automatic outlining has reached today's limit" }, { status: 503 });
  }

  try {
    const { image, size, point } = parsed.data;
    return Response.json({ outline: await outlineObjectAt(image, size, point) });
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      return Response.json({ error: "Automatic outlining is not available" }, { status: 503 });
    }
    if (error instanceof SegmentationError) {
      console.error(`roof outline: ${error.message}`);
      return Response.json({ error: "Automatic outlining failed" }, { status: 502 });
    }
    throw error;
  }
}
