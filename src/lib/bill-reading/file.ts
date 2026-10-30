/** Photos are resized so their long edge is at most this, which keeps bill text sharp and uploads small. */
export const BILL_PHOTO_LONG_EDGE = 2000;
export const MAX_BILL_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_BILL_PDF_BYTES = 5 * 1024 * 1024;

export class BillFileError extends Error {
  constructor(readonly reason: "tooLarge" | "unsupported") {
    super(reason);
  }
}

/** Size to draw an image at so its long edge is at most `maxEdge`, never enlarging it. */
export function fitLongEdge(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new BillFileError("unsupported"));
    reader.readAsDataURL(file);
  });
}

/**
 * Turns the household's bill photo or PDF into a data URL for reading.
 * Photos are turned upright (EXIF), resized and re-encoded as JPEG, which
 * also drops their metadata, such as where the photo was taken. Browser only.
 */
export async function prepareBillFile(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BILL_PDF_BYTES) throw new BillFileError("tooLarge");
    return readAsDataUrl(file);
  }
  if (!file.type.startsWith("image/")) throw new BillFileError("unsupported");
  if (file.size > MAX_BILL_PHOTO_BYTES) throw new BillFileError("tooLarge");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new BillFileError("unsupported");
  }
  const { width, height } = fitLongEdge(bitmap.width, bitmap.height, BILL_PHOTO_LONG_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new BillFileError("unsupported");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
