/** The request body is larger than the route accepts. */
export class PayloadTooLargeError extends Error {}

/**
 * Reads a JSON request body, refusing it as soon as it passes `maxBytes`
 * rather than buffering whatever a client sends. Throws PayloadTooLargeError,
 * or SyntaxError for invalid JSON.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new PayloadTooLargeError(`Body of ${declared} bytes exceeds ${maxBytes}`);
  if (!request.body) throw new SyntaxError("Request has no body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(`Body exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
