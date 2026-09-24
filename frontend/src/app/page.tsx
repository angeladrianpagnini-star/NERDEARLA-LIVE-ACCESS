"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "recording" | "stopped" | "error">("idle");
  const [chunks, setChunks] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startMicrophone = async () => {
    try {
      setError("");
      setChunks(0);
      setSeconds(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setChunks((current) => current + 1);
        }
      };

      recorder.onerror = () => {
        setStatus("error");
        setError("MediaRecorder reported an audio capture error.");
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      setStatus("recording");

      timerRef.current = setInterval(() => {
        setSeconds((current) => current + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to access the microphone."
      );
    }
  };

  const stopMicrophone = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStatus("stopped");
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Nerdearla Vibeathon 2026
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Nerdearla Live Access
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Real-time transcription and translation infrastructure for
            accessible conferences.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Metric label="Audio status" value={status.toUpperCase()} />
            <Metric label="Audio chunks" value={chunks.toString()} />
            <Metric label="Elapsed time" value={`${seconds}s`} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={startMicrophone}
              disabled={status === "recording"}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start microphone
            </button>

            <button
              onClick={stopMicrophone}
              disabled={status !== "recording"}
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop microphone
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
              {error}
            </div>
          )}

          <div className="mt-10 border-t border-slate-800 pt-6 text-sm text-slate-500">
            H1 — Browser Audio Intake
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
