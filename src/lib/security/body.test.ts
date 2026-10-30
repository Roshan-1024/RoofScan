import { describe, expect, it } from "vitest";
import { PayloadTooLargeError, readJsonBody } from "./body";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/test", { method: "POST", body, headers, duplex: "half" } as RequestInit);

/** A body sent in chunks without a Content-Length header, as a streaming client would. */
function streamed(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

describe("readJsonBody", () => {
  it("parses a JSON body within the limit", async () => {
    await expect(readJsonBody(post(JSON.stringify({ a: 1 })), 100)).resolves.toEqual({ a: 1 });
  });

  it("refuses a body whose declared length is too large", async () => {
    const request = post("{}", { "content-length": "5000" });
    await expect(readJsonBody(request, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("stops reading a streamed body once it passes the limit", async () => {
    const request = post(streamed(JSON.stringify({ text: "x".repeat(500) }), 64));
    await expect(readJsonBody(request, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("joins a streamed body that fits", async () => {
    await expect(readJsonBody(post(streamed(JSON.stringify({ ok: true, n: [1, 2, 3] }), 3)), 100)).resolves.toEqual({
      ok: true,
      n: [1, 2, 3],
    });
  });

  it("rejects invalid JSON", async () => {
    await expect(readJsonBody(post("{not json"), 100)).rejects.toBeInstanceOf(SyntaxError);
  });
});
