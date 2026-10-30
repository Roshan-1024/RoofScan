import "server-only";
import { buildObjectPrompt, decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import { APIError } from "openai";
import type { Point, Polygon } from "@/lib/geometry/polygon";
import { maskToOutline } from "@/lib/segmentation/outline";
import { modelClient, ModelUnavailableError, MODELS } from "./client";

/** SAM 3.1 failed, or returned something that couldn't be read. */
export class SegmentationError extends Error {
  constructor(
    message: string,
    /** HTTP status from the Model API, when the request itself failed. */
    readonly upstreamStatus?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export interface ObjectOutline {
  /** Corners in image pixels. */
  polygon: Polygon;
  /** SAM's confidence in the mask, from 0 to 1, when it reports one. */
  confidence: number | null;
}

/** The id SAM reports the prompted object under. */
const OBJECT_ID = 1;

/**
 * Asks SAM 3.1 for the object under `point` in a square image, such as the
 * roof a household tapped, and returns its outline. Returns null when SAM
 * finds nothing there big enough to be a roof.
 */
export async function outlineObjectAt(imageDataUrl: string, size: number, point: Point): Promise<ObjectOutline | null> {
  const pixel = (value: number) => Math.min(size - 1, Math.max(0, Math.floor(value)));
  const prompt = buildObjectPrompt({
    size: { width: size, height: size },
    objects: [{ id: OBJECT_ID, prompts: [{ points: [{ x: pixel(point.x), y: pixel(point.y) }] }] }],
  });

  try {
    const stream = await modelClient().responses.create({
      model: MODELS.segmentation,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl, detail: "auto" },
          ],
        },
      ],
      metadata: { mask_encoding: "lossless", include_confidence: "true" },
      stream: true,
    });
    const result = await parseImageStream(stream).finalResult;
    if (result.outcome.status !== "completed") {
      throw new SegmentationError(`SAM response ended as ${result.outcome.status}`);
    }

    const masks = recordsOfKind(result.records, "mask");
    const record = masks.find((mask) => mask.objectId === String(OBJECT_ID)) ?? masks[0];
    if (!record) return null;
    const polygon = maskToOutline(
      {
        data: decodeMaskToRaster(record.mask),
        width: record.mask.width,
        height: record.mask.height,
        bounds: record.bounds,
      },
      point,
      size,
    );
    return polygon && { polygon, confidence: record.confidence ?? null };
  } catch (error) {
    if (error instanceof ModelUnavailableError || error instanceof SegmentationError) throw error;
    if (error instanceof APIError) {
      throw new SegmentationError(`SAM request failed (${error.status ?? "no response"})`, error.status, { cause: error });
    }
    // Stream and mask parsing errors from @meta-sam/parser.
    throw new SegmentationError(`Couldn't read the SAM response: ${(error as Error).message}`, undefined, { cause: error });
  }
}
