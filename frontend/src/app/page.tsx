"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveTranslationSession,
  LiveSessionStatus,
} from "@/lib/live-translation-session";

import {
  applyTechnicalGlossary,
  TECHNICAL_GLOSSARY,
} from "@/lib/technical-glossary";

type AppView =
  | "home"
  | "conference"
  | "conversation";

type StageId = "stage-a" | "stage-b";

type StageState = {
  id: StageId;
  name: string;
  status: LiveSessionStatus;
  original: string;
  translated: string;
  chunks: number;
  seconds: number;
  error: string;
};

function initialStage(
  id: StageId,
  name: string
): StageState {
  return {
    id,
    name,
    status: "DISCONNECTED",
    original: "",
    translated: "",
    chunks: 0,
    seconds: 0,
    error: "",
  };
}

export default function Home() {
  const [appView, setAppView] =
    useState<AppView>("home");
  const [stageA, setStageA] = useState<StageState>(
    initialStage("stage-a", "Stage A")
  );

  const [stageB, setStageB] = useState<StageState>(
    initialStage("stage-b", "Stage B")
  );

  const sessionARef =
    useRef<LiveTranslationSession | null>(null);

  const sessionBRef =
    useRef<LiveTranslationSession | null>(null);

  const timerARef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const timerBRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const getStageTools = (id: StageId) => {
    if (id === "stage-a") {
      return {
        setStage: setStageA,
        sessionRef: sessionARef,
        timerRef: timerARef,
      };
    }

    return {
      setStage: setStageB,
      sessionRef: sessionBRef,
      timerRef: timerBRef,
    };
  };

  const startStage = async (id: StageId) => {
    const {
      setStage,
      sessionRef,
      timerRef,
    } = getStageTools(id);

    if (sessionRef.current) {
      return;
    }

    setStage((current) => ({
      ...current,
      original: "",
      translated: "",
      chunks: 0,
      seconds: 0,
      error: "",
    }));

    const session =
      new LiveTranslationSession({
        onStatus: (status) => {
          setStage((current) => ({
            ...current,
            status,
          }));
        },

        onOriginalText: (text) => {
          setStage((current) => ({
            ...current,
            original:
              current.original + applyTechnicalGlossary(text),
          }));
        },

        onTranslatedText: (text) => {
          setStage((current) => ({
            ...current,
            translated:
              current.translated + applyTechnicalGlossary(text),
          }));
        },

        onChunk: () => {
          setStage((current) => ({
            ...current,
            chunks:
              current.chunks + 1,
          }));
        },

        onError: (message) => {
          setStage((current) => ({
            ...current,
            error: message,
          }));
        },
      });

    sessionRef.current = session;

    try {
      await session.start();

      timerRef.current =
        setInterval(() => {
          setStage((current) => ({
            ...current,
            seconds:
              current.seconds + 1,
          }));
        }, 1000);
    } catch {
      sessionRef.current = null;
    }
  };

  const stopStage = async (id: StageId) => {
    const {
      sessionRef,
      timerRef,
    } = getStageTools(id);

    if (timerRef.current) {
      clearInterval(
        timerRef.current
      );

      timerRef.current = null;
    }

    const session =
      sessionRef.current;

    if (!session) {
      return;
    }

    await session.stop();

    sessionRef.current = null;
  };

  const startBoth = async () => {
    await Promise.all([
      startStage("stage-a"),
      startStage("stage-b"),
    ]);
  };

  const stopBoth = async () => {
    await Promise.all([
      stopStage("stage-a"),
      stopStage("stage-b"),
    ]);
  };

  useEffect(() => {
    const timerA = timerARef;
    const timerB = timerBRef;
    const sessionA = sessionARef;
    const sessionB = sessionBRef;

    return () => {
      if (timerA.current) {
        clearInterval(
          timerA.current
        );
      }

      if (timerB.current) {
        clearInterval(
          timerB.current
        );
      }

      sessionA.current
        ?.stop()
        .catch(() => undefined);

      sessionB.current
        ?.stop()
        .catch(() => undefined);
    };
  }, []);

  const anyActive =
    isActive(stageA.status) ||
    isActive(stageB.status);

  const bothStreaming =
    stageA.status === "STREAMING" &&
    stageB.status === "STREAMING";

  if (appView === "home") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <header className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
              Nerdearla Vibeathon 2026
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Nerdearla Live Access
            </h1>

            <p className="mt-3 max-w-2xl text-slate-400">
              Real-time multilingual accessibility and session documentation.
            </p>
          </header>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                Conference Mode
              </div>

              <h2 className="mt-3 text-2xl font-bold">
                Live Conference
              </h2>

              <p className="mt-3 text-slate-400">
                Continuous transcription and translation with speakers,
                segments, session memory, and subtitle-ready records.
              </p>

              <div className="mt-6 space-y-2 text-sm text-slate-300">
                <p>Live transcription and translation</p>
                <p>Multiple speakers and segments</p>
                <p>Pause and resume without losing history</p>
                <p>Session and subtitle export</p>
              </div>

              <button
                type="button"
                onClick={() => setAppView("conference")}
                className="mt-8 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950"
              >
                Start Conference
              </button>
            </article>

            <article className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Conversation Mode
              </div>

              <h2 className="mt-3 text-2xl font-bold">
                Bilingual Conversation
              </h2>

              <p className="mt-3 text-slate-400">
                Alternating bilingual dialogue with persistent speaker turns
                and a complete conversation record.
              </p>

              <div className="mt-6 space-y-2 text-sm text-slate-300">
                <p>English to Spanish</p>
                <p>Spanish to English</p>
                <p>Speaker A and Speaker B turns</p>
                <p>Persistent conversation history</p>
              </div>

              <button
                type="button"
                onClick={() => setAppView("conversation")}
                className="mt-8 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950"
              >
                Start Conversation
              </button>
            </article>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                  Infrastructure
                </div>
                <div className="mt-1 font-semibold">
                  2+ simultaneous live sessions supported
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Terminology
                </div>
                <div className="mt-1 font-semibold">
                  Technical glossary active
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">


          <button


            type="button"


            onClick={() => setAppView("home")}


            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold"


          >


            Back to Mode Selection


          </button>



          <div className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">


            {appView === "conference"


              ? "Conference Mode"


              : "Conversation Mode"}


          </div>


        </div>



        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Nerdearla Vibeathon 2026
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Nerdearla Live Access
          </h1>

          <p className="mt-3 text-slate-400">
            Concurrent real-time conference translation
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>
              <div className="text-sm text-slate-400">
                Multi-session status
              </div>

              <div className="mt-1 text-xl font-semibold">
                {bothStreaming
                  ? "2 LIVE SESSIONS"
                  : anyActive
                    ? "SESSION STARTING / ACTIVE"
                    : "READY"}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startBoth}
                disabled={anyActive}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start Both Sessions
              </button>

              <button
                onClick={stopBoth}
                disabled={!anyActive}
                className="rounded-xl border border-slate-700 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Stop Both
              </button>
            </div>

          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">

          <StagePanel
            stage={stageA}
            onStart={() =>
              startStage("stage-a")
            }
            onStop={() =>
              stopStage("stage-a")
            }
          />

          <StagePanel
            stage={stageB}
            onStart={() =>
              startStage("stage-b")
            }
            onStop={() =>
              stopStage("stage-b")
            }
          />

        </div>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Technical Glossary
              </div>

              <div className="mt-1 text-lg font-semibold">
                ACTIVE - {TECHNICAL_GLOSSARY.length} canonical terms
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TECHNICAL_GLOSSARY.map((entry) => (
                <span
                  key={entry.canonical}
                  className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                >
                  {entry.canonical}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Deterministic terminology normalization for conference-specific vocabulary.
          </p>
        </section>

        <footer className="mt-6 text-sm text-slate-500">
          H5 - Concurrent Gemini Live sessions - EN to ES - PCM 16 kHz
        </footer>

      </div>
    </main>
  );
}

function StagePanel({
  stage,
  onStart,
  onStop,
}: {
  stage: StageState;
  onStart: () => void;
  onStop: () => void;
}) {
  const active =
    isActive(stage.status);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">

      <div className="flex items-start justify-between gap-4">

        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
            {stage.id}
          </div>

          <h2 className="mt-1 text-2xl font-bold">
            {stage.name}
          </h2>
        </div>

        <div className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold">
          {stage.status}
        </div>

      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">

        <Metric
          label="PCM chunks"
          value={stage.chunks.toString()}
        />

        <Metric
          label="Elapsed"
          value={`${stage.seconds}s`}
        />

      </div>

      <div className="mt-5 flex gap-3">

        <button
          onClick={onStart}
          disabled={active}
          className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-950 disabled:opacity-40"
        >
          Start
        </button>

        <button
          onClick={onStop}
          disabled={!active}
          className="rounded-xl border border-slate-700 px-4 py-2 font-semibold disabled:opacity-40"
        >
          Stop
        </button>

      </div>

      {stage.error && (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {stage.error}
        </div>
      )}

      <div className="mt-6 space-y-4">

        <TranscriptBox
          title="Original - English"
          text={stage.original}
          placeholder="Waiting for English speech..."
        />

        <TranscriptBox
          title="Spanish - Live Translation"
          text={stage.translated}
          placeholder="Spanish translation will appear here..."
        />

      </div>

    </section>
  );
}

function TranscriptBox({
  title,
  text,
  placeholder,
}: {
  title: string;
  text: string;
  placeholder: string;
}) {
  return (
    <div className="min-h-40 rounded-2xl border border-slate-800 bg-slate-950 p-5">

      <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
        {title}
      </div>

      <div className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">
        {text || (
          <span className="text-slate-600">
            {placeholder}
          </span>
        )}
      </div>

    </div>
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
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-lg font-semibold">
        {value}
      </div>

    </div>
  );
}

function isActive(
  status: LiveSessionStatus
): boolean {
  return (
    status === "CONNECTING" ||
    status === "CONNECTED" ||
    status === "STREAMING" ||
    status === "FINALIZING"
  );
}
