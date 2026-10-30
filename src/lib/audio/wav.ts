/** Muse Voice Transcribe takes mono 16-bit PCM WAV at 16 or 24 kHz. */
export const TRANSCRIBE_SAMPLE_RATE = 16_000;
const HEADER_BYTES = 44;

/** Encodes mono samples in [-1, 1] as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(HEADER_BYTES + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(HEADER_BYTES + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return bytes;
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number;
}

/**
 * Reads the format of a PCM WAV file, walking its chunks, or returns null
 * when it isn't one. Used to check uploads before they reach the model.
 */
export function readWavInfo(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < HEADER_BYTES) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (text(0) !== "RIFF" || text(8) !== "WAVE") return null;

  let format: Omit<WavInfo, "durationSeconds"> | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = text(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 24 <= bytes.length) {
      if (view.getUint16(offset + 8, true) !== 1) return null; // not PCM
      format = {
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      };
    } else if (id === "data" && format) {
      const dataBytes = Math.min(size, bytes.length - offset - 8);
      const bytesPerSecond = format.sampleRate * format.channels * (format.bitsPerSample / 8);
      return { ...format, durationSeconds: bytesPerSecond > 0 ? dataBytes / bytesPerSecond : 0 };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}
