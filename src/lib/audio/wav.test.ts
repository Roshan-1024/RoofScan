import { describe, expect, it } from "vitest";
import { encodeWav, readWavInfo, TRANSCRIBE_SAMPLE_RATE } from "./wav";

describe("encodeWav", () => {
  it("writes a mono 16-bit PCM file that reads back", () => {
    const second = new Float32Array(TRANSCRIBE_SAMPLE_RATE).map((_, i) => Math.sin(i / 10));
    const wav = encodeWav(second, TRANSCRIBE_SAMPLE_RATE);
    expect(wav.length).toBe(44 + TRANSCRIBE_SAMPLE_RATE * 2);
    expect(readWavInfo(wav)).toEqual({ sampleRate: 16_000, channels: 1, bitsPerSample: 16, durationSeconds: 1 });
  });

  it("clips samples outside [-1, 1]", () => {
    const wav = encodeWav(new Float32Array([2, -2]), 16_000);
    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});

describe("readWavInfo", () => {
  it("skips chunks before the data", () => {
    const wav = encodeWav(new Float32Array(24_000), 24_000);
    // Insert a LIST chunk between fmt and data, as some encoders do.
    const list = new Uint8Array([...new TextEncoder().encode("LIST"), 4, 0, 0, 0, 1, 2, 3, 4]);
    const withList = new Uint8Array([...wav.subarray(0, 36), ...list, ...wav.subarray(36)]);
    expect(readWavInfo(withList)?.durationSeconds).toBeCloseTo(1);
  });

  it("rejects files that aren't PCM WAV", () => {
    expect(readWavInfo(new TextEncoder().encode("ID3 not a wav file at all, just text ............."))).toBeNull();
    const wav = encodeWav(new Float32Array(10), 16_000);
    new DataView(wav.buffer).setUint16(20, 3, true); // float format
    expect(readWavInfo(wav)).toBeNull();
  });
});
