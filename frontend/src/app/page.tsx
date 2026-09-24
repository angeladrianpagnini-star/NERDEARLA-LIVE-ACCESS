"use client";

import { useRef, useState } from "react";
import { GoogleGenAI, Modality, Session } from "@google/genai";

type ConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "STREAMING"
  | "FINALIZING"
  | "ERROR";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export default function Home() {
  const [status, setStatus] =
    useState<ConnectionStatus>("DISCONNECTED");

  const [interim, setInterim] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [chunks, setChunks] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const startLiveTranscription = async () => {
    try {
      setError("");
      setInterim("");
      setFinalTranscript("");
      setChunks(0);
      setSeconds(0);
      setStatus("CONNECTING");

      //
      // 1. Request a short-lived token from our server.
      //
      const tokenResponse = await fetch("/api/token", {
        method: "POST",
      });

      if (!tokenResponse.ok) {
        throw new Error(
          `Token provisioning failed (${tokenResponse.status})`
        );
      }

      const tokenData = await tokenResponse.json();

      if (!tokenData.token) {
        throw new Error("No ephemeral token received");
      }

      //
      // 2. Connect directly to Gemini Live using the ephemeral token.
      //
      const ai = new GoogleGenAI({
        apiKey: tokenData.token,
        httpOptions: {
          apiVersion: "v1alpha",
        },
      });

      const session = await ai.live.connect({
        model: "gemini-3.5-transcribe-live",

        config: {
          responseModalities: [Modality.TEXT],

          inputAudioTranscription: {
            languageCodes: ["es-419"],
          },
        },

        callbacks: {
          onopen: () => {
            console.log("Gemini Live connected");
            setStatus("CONNECTED");
          },

          onmessage: (message) => {
            const content = message.serverContent;

            if (!content) {
              return;
            }

            const interimText =
              content.interimInputTranscription?.text;

            if (interimText) {
              setInterim(interimText);
            }

            const finalText =
              content.inputTranscription?.text?.trim();

            if (finalText) {
              setFinalTranscript((current) => {
                if (!current) {
                  return finalText;
                }

                return `${current}\n${finalText}`;
              });

              setInterim("");
            }
          },

          onerror: (event) => {
            console.error("Gemini Live error:", event);

            setError(
              event.message ||
                "Gemini Live connection error"
            );

            setStatus("ERROR");
          },

          onclose: (event) => {
            console.log(
              "Gemini Live closed:",
              event.reason
            );

            setStatus((current) =>
              current === "ERROR"
                ? "ERROR"
                : "DISCONNECTED"
            );
          },
        },
      });

      sessionRef.current = session;

      //
      // 3. Open microphone.
      //
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      streamRef.current = stream;

      //
      // 4. Start Web Audio pipeline.
      //
      const audioContext = new AudioContext();

      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule(
        "/audio/pcm-processor.js"
      );

      const source =
        audioContext.createMediaStreamSource(stream);

      const worklet = new AudioWorkletNode(
        audioContext,
        "pcm-processor"
      );

      workletRef.current = worklet;

      worklet.port.onmessage = (event) => {
        const pcmBuffer =
          event.data.pcm as ArrayBuffer;

        if (
          !pcmBuffer ||
          !sessionRef.current
        ) {
          return;
        }

        const base64 =
          arrayBufferToBase64(pcmBuffer);

        sessionRef.current.sendRealtimeInput({
          audio: {
            data: base64,
            mimeType: "audio/pcm;rate=16000",
          },
        });

        setChunks((current) => current + 1);
        setStatus("STREAMING");
      };

      source.connect(worklet);

      //
      // Keep AudioWorklet alive without reproducing microphone audio.
      //
      const silentGain =
        audioContext.createGain();

      silentGain.gain.value = 0;

      worklet.connect(silentGain);
      silentGain.connect(
        audioContext.destination
      );

      timerRef.current = setInterval(() => {
        setSeconds((current) => current + 1);
      }, 1000);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start live transcription"
      );

      setStatus("ERROR");
    }
  };

  const stopLiveTranscription = async () => {
    try {
      setStatus("FINALIZING");

      //
      // 1. Stop generating new microphone audio.
      //
      workletRef.current?.disconnect();
      workletRef.current = null;

      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      //
      // 2. Tell Gemini no more audio is coming.
      //
      if (sessionRef.current) {
        sessionRef.current.sendRealtimeInput({
          audioStreamEnd: true,
        });
      }

      //
      // 3. Give Gemini time to flush the final transcription.
      //
      await new Promise((resolve) =>
        setTimeout(resolve, 3000)
      );

      //
      // 4. Close the Live session only after the flush window.
      //
      sessionRef.current?.close();
      sessionRef.current = null;

      setStatus("DISCONNECTED");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to stop live transcription"
      );

      setStatus("ERROR");
    }
  };

  const isActive =
    status === "CONNECTING" ||
    status === "CONNECTED" ||
    status === "STREAMING" ||
    status === "FINALIZING";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">

          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Nerdearla Vibeathon 2026
          </p>

          <h1 className="text-4xl font-bold">
            Nerdearla Live Access
          </h1>

          <p className="mt-3 text-slate-400">
            Real-time AI transcription for accessible conferences.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">

            <Metric
              label="Live connection"
              value={status}
            />

            <Metric
              label="PCM chunks"
              value={chunks.toString()}
            />

            <Metric
              label="Elapsed time"
              value={`${seconds}s`}
            />

          </div>

          <div className="mt-6 flex gap-3">

            <button
              onClick={startLiveTranscription}
              disabled={isActive}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start live transcription
            </button>

            <button
              onClick={stopLiveTranscription}
              disabled={
                status !== "STREAMING" &&
                status !== "CONNECTED"
              }
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop
            </button>

          </div>

          {status === "FINALIZING" && (
            <div className="mt-5 rounded-xl border border-cyan-900 bg-cyan-950/20 p-4 text-cyan-300">
              Finalizing transcript...
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
              {error}
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2">

            <div className="min-h-56 rounded-2xl border border-cyan-900/50 bg-slate-950 p-6">

              <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                Interim — Live
              </div>

              <div className="mt-4 text-xl leading-relaxed text-slate-300">
                {interim ||
                  "Waiting for speech..."}
              </div>

            </div>

            <div className="min-h-56 rounded-2xl border border-emerald-900/40 bg-slate-950 p-6">

              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Final transcript
              </div>

              <div className="mt-4 whitespace-pre-wrap text-xl leading-relaxed">
                {finalTranscript ||
                  "Finalized transcription will appear here."}
              </div>

            </div>

          </div>

          <div className="mt-8 border-t border-slate-800 pt-6 text-sm text-slate-500">
            H2 — Gemini Live Transcription · PCM 16 kHz · Ephemeral authentication
          </div>

        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">

      <div className="text-sm text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-xl font-semibold">
        {value}
      </div>

    </div>
  );
}


