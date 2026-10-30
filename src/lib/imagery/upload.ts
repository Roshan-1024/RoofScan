import type { Point } from "@/lib/geometry/polygon";
import type { RoofSnapshot } from "./esri";

/** Uploaded photos are fitted into a square of this many pixels. */
export const UPLOAD_SNAPSHOT_SIZE = 800;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** A calibration line shorter than this is too imprecise to set the scale. */
export const MIN_SCALE_LINE_PX = 20;
export const MAX_SCALE_LENGTH_M = 200;
const FEET_PER_METRE = 3.28084;

export class UploadError extends Error {
  constructor(readonly reason: "tooLarge" | "notImage") {
    super(reason);
  }
}

/** Where an image of `width` × `height` sits when fitted, centred, into a square of `size`. */
export function fitIntoSquare(width: number, height: number, size: number) {
  const scale = size / Math.max(width, height);
  const drawWidth = Math.round(width * scale);
  const drawHeight = Math.round(height * scale);
  return { drawWidth, drawHeight, offsetX: Math.round((size - drawWidth) / 2), offsetY: Math.round((size - drawHeight) / 2) };
}

export function toMetres(length: number, unit: "m" | "ft"): number {
  return unit === "ft" ? length / FEET_PER_METRE : length;
}

/**
 * Ground distance per pixel from a line the household marked and its real
 * length, or null when the line is too short or the length implausible.
 */
export function metersPerPixelFromLine(a: Point, b: Point, lengthM: number): number | null {
  const pixels = Math.hypot(b.x - a.x, b.y - a.y);
  if (pixels < MIN_SCALE_LINE_PX || !(lengthM >= 1) || lengthM > MAX_SCALE_LENGTH_M) return null;
  return lengthM / pixels;
}

/**
 * Decodes a photo (respecting its EXIF orientation) and fits it into a
 * square canvas. Browser only; the photo never leaves the browser here.
 */
export async function loadUploadedPhoto(file: File): Promise<{ dataUrl: string; size: number }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("tooLarge");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UploadError("notImage");
  }
  const size = UPLOAD_SNAPSHOT_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new UploadError("notImage");
  const { drawWidth, drawHeight, offsetX, offsetY } = fitIntoSquare(bitmap.width, bitmap.height, size);
  context.fillStyle = "#d4d4d4";
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
  bitmap.close();
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), size };
}

/** Builds the snapshot the rest of the check uses from a calibrated photo. */
export function uploadSnapshot(
  photo: { dataUrl: string; size: number },
  metersPerPixel: number,
  center: { lat: number; lon: number },
): RoofSnapshot {
  return { ...photo, metersPerPixel, center, zoom: null, source: "upload" };
}
