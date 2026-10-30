"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Dictionary, Locale } from "@/i18n";
import type { PlanContext } from "@/lib/assistant/context";
import { MicrophoneError, recordingToWav, startRecording, toBase64, type Recording } from "@/lib/audio/record";
import { fill } from "@/lib/format";

/** Questions are short; the server accepts up to a minute. */
const MAX_RECORDING_SECONDS = 45;

type Status =
  | "idle"
  | "recording"
  | "thinking"
  | "micDenied"
  | "micUnsupported"
  | "noSpeech"
  | "busy"
  | "error"
  | "tooLong";

interface Turn {
  question: string;
  answer: string;
  /** Panels the plan was changed to, when the household asked for a change. */
  changedTo?: number;
}

interface AskReply {
  question: string;
  answer: string | null;
  actions: { type: "setPanels"; panels: number }[];
}

function MicrophoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Spoken or typed questions about the plan. Speech is turned into text by
 * Muse Voice Transcribe and answered by Muse Spark on the server, from the
 * plan's own inputs; an answer can change the panel count on screen.
 */
export function AskPanel({
  locale,
  dict,
  context,
  onSetPanels,
}: {
  locale: Locale;
  dict: Dictionary["check"]["ask"];
  context: PlanContext;
  onSetPanels: (panels: number) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const recording = useRef<Recording | null>(null);
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; limit?: ReturnType<typeof setTimeout> }>({});
  const inputId = useId();

  function clearTimers() {
    clearInterval(timers.current.tick);
    clearTimeout(timers.current.limit);
  }

  // Turn the microphone off if the household leaves the page mid-question.
  useEffect(
    () => () => {
      clearTimers();
      recording.current?.cancel();
    },
    [],
  );

  async function ask(body: { question: string } | { audio: string }) {
    setStatus("thinking");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, locale, context }),
      });
      if (response.status === 429) return setStatus("busy");
      if (response.status === 413) return setStatus("tooLong");
      if (!response.ok) throw new Error(`Ask returned ${response.status}`);
      const reply = (await response.json()) as AskReply;
      if (!reply.answer) return setStatus("noSpeech");
      const change = reply.actions.find((action) => action.type === "setPanels");
      if (change) onSetPanels(change.panels);
      setTurns((current) => [...current, { question: reply.question, answer: reply.answer!, changedTo: change?.panels }].slice(-5));
      setText("");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function stopAndAsk() {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    clearTimers();
    setStatus("thinking");
    try {
      const wav = await recordingToWav(await current.stop());
      await ask({ audio: `data:audio/wav;base64,${toBase64(wav)}` });
    } catch {
      setStatus("error");
    }
  }

  async function toggleRecording() {
    if (status === "recording") return stopAndAsk();
    try {
      recording.current = await startRecording();
    } catch (error) {
      setStatus(error instanceof MicrophoneError && error.reason === "unsupported" ? "micUnsupported" : "micDenied");
      return;
    }
    const started = Date.now();
    setSeconds(0);
    setStatus("recording");
    timers.current.tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    timers.current.limit = setTimeout(() => void stopAndAsk(), MAX_RECORDING_SECONDS * 1000);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const question = text.trim();
    if (question.length >= 2 && status !== "thinking" && status !== "recording") void ask({ question });
  }

  const busy = status === "thinking";
  const message = {
    idle: null,
    recording: fill(dict.recording, { seconds }),
    thinking: dict.thinking,
    micDenied: dict.micDenied,
    micUnsupported: dict.micUnsupported,
    noSpeech: dict.noSpeech,
    busy: dict.busy,
    error: dict.error,
    tooLong: dict.tooLong,
  }[status];
  const isProblem = status !== "idle" && status !== "recording" && status !== "thinking";

  return (
    <section aria-labelledby={`${inputId}-title`} className="space-y-4 rounded-2xl border border-border bg-surface p-5 print:hidden">
      <div>
        <h2 id={`${inputId}-title`} className="text-lg font-semibold">
          {dict.title}
        </h2>
        <p className="mt-1 text-muted">{dict.intro}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void toggleRecording()}
          disabled={busy}
          aria-pressed={status === "recording"}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold disabled:opacity-60 ${
            status === "recording" ? "bg-danger text-white" : "bg-primary text-primary-ink"
          }`}
        >
          <MicrophoneIcon />
          {status === "recording" ? dict.stop : dict.speak}
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          {dict.label}
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={dict.placeholder}
          maxLength={500}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={busy || status === "recording" || text.trim().length < 2}
          className="rounded-xl border border-border bg-surface px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {dict.send}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={dict.suggestionsLabel}>
        {dict.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={busy || status === "recording"}
            onClick={() => void ask({ question: suggestion })}
            className="rounded-full border border-border bg-surface-muted px-3 py-1.5 disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="space-y-3">
        {message && (
          <p className={`rounded-xl p-3 text-sm ${isProblem ? "bg-surface-muted text-danger" : "bg-primary-soft"}`}>{message}</p>
        )}
        {turns
          .slice()
          .reverse()
          .map((turn, index) => (
            <div key={turns.length - index} className="space-y-2 rounded-xl border border-border p-4">
              <p className="text-sm text-muted">
                <span className="font-medium">{dict.you}:</span> {turn.question}
              </p>
              <p>
                <span className="sr-only">{dict.answer}: </span>
                {turn.answer}
              </p>
              {turn.changedTo !== undefined && (
                <p className="text-sm font-medium text-primary">{fill(dict.changed, { panels: turn.changedTo })}</p>
              )}
            </div>
          ))}
      </div>

      <p className="text-xs text-muted">{dict.privacy}</p>
    </section>
  );
}
