import { encodeWav, TRANSCRIBE_SAMPLE_RATE } from "./wav";

/** The microphone is blocked, or the browser can't record. */
export class MicrophoneError extends Error {
  constructor(readonly reason: "denied" | "unsupported") {
    super(reason);
  }
}

export interface Recording {
  /** Stops recording and returns the audio, in whatever format the browser records. */
  stop(): Promise<Blob>;
  /** Stops recording and discards the audio. */
  cancel(): void;
}

/** Starts recording from the microphone. Browser only. */
export async function startRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new MicrophoneError("unsupported");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch {
    throw new MicrophoneError("denied");
  }

  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  // Releasing the tracks turns off the browser's recording indicator.
  const release = () => stream.getTracks().forEach((track) => track.stop());
  recorder.start();

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = release;
      if (recorder.state !== "inactive") recorder.stop();
      else release();
    },
  };
}

/**
 * Decodes a recording and resamples it to mono 16 kHz, then encodes it as
 * 16-bit PCM WAV, the format Muse Voice Transcribe takes. Browser only.
 */
export async function recordingToWav(recording: Blob): Promise<Uint8Array> {
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await recording.arrayBuffer());
  } finally {
    void context.close();
  }
  const frames = Math.max(1, Math.ceil(decoded.duration * TRANSCRIBE_SAMPLE_RATE));
  // A one-channel destination mixes stereo down to mono.
  const offline = new OfflineAudioContext(1, frames, TRANSCRIBE_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), TRANSCRIBE_SAMPLE_RATE);
}

/** Base64 of bytes, in chunks small enough for String.fromCharCode. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
