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

import {
  addSegmentToSession,
  appendOriginalText,
  appendTranslatedText,
  closeTranscriptSegment,
  closeTranscriptSession,
  createTranscriptSegment,
  createTranscriptSession,
  updateSegmentInSession,
  type LanguageCode,
  type TranscriptSession,
} from "@/lib/session-memory";

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

  const [conferenceTitle, setConferenceTitle] =
    useState("Nerdearla Live Conference");

  const [conferenceSpeaker, setConferenceSpeaker] =
    useState("Speaker 1");

  const [
    conferenceSourceLanguage,
    setConferenceSourceLanguage,
  ] = useState<LanguageCode>("en");

  const [
    conferenceSession,
    setConferenceSession,
  ] = useState<TranscriptSession | null>(
    null
  );

  const [
    conferenceStatus,
    setConferenceStatus,
  ] = useState<LiveSessionStatus>(
    "DISCONNECTED"
  );

  const [
    conferenceError,
    setConferenceError,
  ] = useState("");

  const conferenceLiveRef =
    useRef<LiveTranslationSession | null>(
      null
    );

  const conferenceSegmentIdRef =
    useRef<string | null>(null);

  const [
    activeConferenceSegmentId,
    setActiveConferenceSegmentId,
  ] = useState<string | null>(null);

  const [
    conferenceActive,
    setConferenceActive,
  ] = useState(false);
  const [
    conversationSession,
    setConversationSession,
  ] = useState<TranscriptSession | null>(
    null
  );

  const [
    conversationSpeaker,
    setConversationSpeaker,
  ] = useState<"A" | "B">("A");

  const [
    conversationStatus,
    setConversationStatus,
  ] = useState<LiveSessionStatus>(
    "DISCONNECTED"
  );

  const [
    conversationError,
    setConversationError,
  ] = useState("");

  const [
    conversationActive,
    setConversationActive,
  ] = useState(false);

  const [
    activeConversationSegmentId,
    setActiveConversationSegmentId,
  ] = useState<string | null>(null);

  const conversationSessionRef =
    useRef<TranscriptSession | null>(
      null
    );

  const conversationLiveRef =
    useRef<LiveTranslationSession | null>(
      null
    );

  const conversationSegmentIdRef =
    useRef<string | null>(null);

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

  const startConferenceCapture =
    async () => {
      if (conferenceLiveRef.current) {
        return;
      }

      setConferenceError("");

      const targetLanguage:
        LanguageCode =
          conferenceSourceLanguage === "en"
            ? "es"
            : "en";

      let baseSession =
        conferenceSession;

      if (!baseSession) {
        baseSession =
          createTranscriptSession(
            "conference",
            conferenceTitle.trim() ||
              "Live Conference"
          );
      }

      const segment =
        createTranscriptSegment(
          conferenceSpeaker.trim() ||
            "Speaker",
          conferenceSourceLanguage,
          targetLanguage
        );

      conferenceSegmentIdRef.current =
        segment.id;

      setActiveConferenceSegmentId(
        segment.id
      );

      const sessionWithSegment =
        addSegmentToSession(
          baseSession,
          segment
        );

      setConferenceSession(
        sessionWithSegment
      );

      const live =
        new LiveTranslationSession(
          {
            onStatus: (status) => {
              setConferenceStatus(
                status
              );
            },

            onOriginalText: (text) => {
              const normalized =
                applyTechnicalGlossary(
                  text
                );

              const segmentId =
                conferenceSegmentIdRef
                  .current;

              if (!segmentId) {
                return;
              }

              setConferenceSession(
                (current) => {
                  if (!current) {
                    return current;
                  }

                  return updateSegmentInSession(
                    current,
                    segmentId,
                    (currentSegment) =>
                      appendOriginalText(
                        currentSegment,
                        normalized
                      )
                  );
                }
              );
            },

            onTranslatedText: (text) => {
              const normalized =
                applyTechnicalGlossary(
                  text
                );

              const segmentId =
                conferenceSegmentIdRef
                  .current;

              if (!segmentId) {
                return;
              }

              setConferenceSession(
                (current) => {
                  if (!current) {
                    return current;
                  }

                  return updateSegmentInSession(
                    current,
                    segmentId,
                    (currentSegment) =>
                      appendTranslatedText(
                        currentSegment,
                        normalized
                      )
                  );
                }
              );
            },

            onError: (message) => {
              setConferenceError(
                message
              );
            },
          },
          {
            sourceLanguage:
              conferenceSourceLanguage,
            targetLanguage,
          }
        );

      conferenceLiveRef.current =
        live;

      setConferenceActive(true);

      try {
        await live.start();
      } catch {
        conferenceLiveRef.current =
          null;

        conferenceSegmentIdRef.current =
          null;

        setActiveConferenceSegmentId(
          null
        );

        setConferenceActive(false);
      }
    };

  const pauseConferenceCapture =
    async () => {
      const live =
        conferenceLiveRef.current;

      if (!live) {
        return;
      }

      const segmentId =
        conferenceSegmentIdRef.current;

      /*
       * Detach the live engine immediately
       * so a second pause/start cannot race
       * against this shutdown.
       */
      conferenceLiveRef.current =
        null;

      setConferenceActive(false);

      await live.stop();

      if (segmentId) {
        setConferenceSession(
          (current) => {
            if (!current) {
              return current;
            }

            return updateSegmentInSession(
              current,
              segmentId,
              closeTranscriptSegment
            );
          }
        );

        /*
         * Keep the last segment selected so
         * its language direction and final
         * transcript remain visible.
         */
        setActiveConferenceSegmentId(
          segmentId
        );
      }

      conferenceSegmentIdRef.current =
        null;

      setConferenceStatus(
        "DISCONNECTED"
      );
    };

  const endConference =
    async () => {
      if (conferenceLiveRef.current) {
        await pauseConferenceCapture();
      }

      setConferenceSession(
        (current) =>
          current
            ? closeTranscriptSession(
                current
              )
            : current
      );

    };

  const startConversationTurn =
    async (
      speaker:
        "A" | "B" = conversationSpeaker
    ) => {
      if (conversationLiveRef.current) {
        return;
      }

      const sourceLanguage:
        LanguageCode =
          speaker === "A"
            ? "en"
            : "es";

      const targetLanguage:
        LanguageCode =
          sourceLanguage === "en"
            ? "es"
            : "en";

      let baseSession =
        conversationSessionRef.current;

      if (!baseSession) {
        baseSession =
          createTranscriptSession(
            "conversation",
            "Bilingual Conversation"
          );
      }

      if (baseSession.endedAt) {
        return;
      }

      const segment =
        createTranscriptSegment(
          `Speaker ${speaker}`,
          sourceLanguage,
          targetLanguage
        );

      const nextSession =
        addSegmentToSession(
          baseSession,
          segment
        );

      conversationSessionRef.current =
        nextSession;

      setConversationSession(
        nextSession
      );

      conversationSegmentIdRef.current =
        segment.id;

      setActiveConversationSegmentId(
        segment.id
      );

      setConversationSpeaker(
        speaker
      );

      setConversationError("");

      const live =
        new LiveTranslationSession(
          {
            onStatus: (status) => {
              setConversationStatus(
                status
              );
            },

            onOriginalText: (text) => {
              const normalized =
                applyTechnicalGlossary(
                  text
                );

              setConversationSession(
                (current) => {
                  if (!current) {
                    return current;
                  }

                  const next =
                    updateSegmentInSession(
                      current,
                      segment.id,
                      (currentSegment) =>
                        appendOriginalText(
                          currentSegment,
                          normalized
                        )
                    );

                  conversationSessionRef.current =
                    next;

                  return next;
                }
              );
            },

            onTranslatedText: (
              text
            ) => {
              const normalized =
                applyTechnicalGlossary(
                  text
                );

              setConversationSession(
                (current) => {
                  if (!current) {
                    return current;
                  }

                  const next =
                    updateSegmentInSession(
                      current,
                      segment.id,
                      (currentSegment) =>
                        appendTranslatedText(
                          currentSegment,
                          normalized
                        )
                    );

                  conversationSessionRef.current =
                    next;

                  return next;
                }
              );
            },

            onChunk: () => {},

            onError: (message) => {
              setConversationError(
                message
              );
            },
          },
          {
            sourceLanguage,
            targetLanguage,
          }
        );

      conversationLiveRef.current =
        live;

      setConversationActive(true);

      try {
        await live.start();
      }
      catch {
        conversationLiveRef.current =
          null;

        conversationSegmentIdRef.current =
          null;

        setActiveConversationSegmentId(
          null
        );

        setConversationActive(false);
      }
    };

  const pauseConversationTurn =
    async () => {
      const live =
        conversationLiveRef.current;

      if (!live) {
        return;
      }

      const segmentId =
        conversationSegmentIdRef.current;

      conversationLiveRef.current =
        null;

      setConversationActive(false);

      await live.stop();

      if (segmentId) {
        const currentSession =
          conversationSessionRef.current;

        if (currentSession) {
          const closedSession =
            updateSegmentInSession(
              currentSession,
              segmentId,
              closeTranscriptSegment
            );

          conversationSessionRef.current =
            closedSession;

          setConversationSession(
            closedSession
          );
        }

        setActiveConversationSegmentId(
          segmentId
        );
      }

      conversationSegmentIdRef.current =
        null;

      setConversationStatus(
        "DISCONNECTED"
      );
    };

  const switchConversationTurn =
    async () => {
      const currentSpeaker =
        conversationSpeaker;

      if (conversationLiveRef.current) {
        await pauseConversationTurn();
      }

      const nextSpeaker:
        "A" | "B" =
          currentSpeaker === "A"
            ? "B"
            : "A";

      setConversationSpeaker(
        nextSpeaker
      );

      await startConversationTurn(
        nextSpeaker
      );
    };

  const endConversation =
    async () => {
      if (conversationLiveRef.current) {
        await pauseConversationTurn();
      }

      const currentSession =
        conversationSessionRef.current;

      if (currentSession) {
        const closedSession =
          closeTranscriptSession(
            currentSession
          );

        conversationSessionRef.current =
          closedSession;

        setConversationSession(
          closedSession
        );
      }
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

  if (appView === "conference") {
    const activeSegment =
      conferenceSession?.segments.find(
        (segment) =>
          segment.id ===
          activeConferenceSegmentId
      );

    const conferenceEnded =
      conferenceSession?.endedAt != null;

    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() =>
                setAppView("home")
              }
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold"
            >
              Back to Mode Selection
            </button>

            <div className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
              Conference Mode
            </div>
          </div>

          <header className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
              Nerdearla Vibeathon 2026
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Live Conference
            </h1>

            <p className="mt-3 max-w-3xl text-slate-400">
              Continuous bilingual transcription with persistent session segments.
            </p>
          </header>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Conference title
                </span>

                <input
                  value={conferenceTitle}
                  onChange={(event) =>
                    setConferenceTitle(
                      event.target.value
                    )
                  }
                  disabled={
                    conferenceSession !==
                    null
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Current speaker
                </span>

                <input
                  value={conferenceSpeaker}
                  onChange={(event) =>
                    setConferenceSpeaker(
                      event.target.value
                    )
                  }
                  disabled={
                    conferenceActive
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none disabled:opacity-60"
                />
              </label>
            </div>

            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Translation direction
              </div>

              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={
                    conferenceActive
                  }
                  onClick={() =>
                    setConferenceSourceLanguage(
                      "en"
                    )
                  }
                  className={
                    conferenceSourceLanguage ===
                    "en"
                      ? "rounded-xl border border-cyan-400 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-300 disabled:opacity-50"
                      : "rounded-xl border border-slate-700 px-4 py-2 font-semibold disabled:opacity-50"
                  }
                >
                  English to Spanish
                </button>

                <button
                  type="button"
                  disabled={
                    conferenceActive
                  }
                  onClick={() =>
                    setConferenceSourceLanguage(
                      "es"
                    )
                  }
                  className={
                    conferenceSourceLanguage ===
                    "es"
                      ? "rounded-xl border border-cyan-400 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-300 disabled:opacity-50"
                      : "rounded-xl border border-slate-700 px-4 py-2 font-semibold disabled:opacity-50"
                  }
                >
                  Spanish to English
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={
                  startConferenceCapture
                }
                disabled={
                  conferenceActive ||
                  conferenceEnded
                }
                className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {conferenceEnded
                  ? "Conference Ended"
                  : conferenceSession
                    ? "Resume Capture"
                    : "Start Conference"}
              </button>

              <button
                type="button"
                onClick={
                  pauseConferenceCapture
                }
                disabled={
                  !conferenceActive
                }
                className="rounded-xl border border-slate-700 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pause Capture
              </button>

              <button
                type="button"
                onClick={
                  endConference
                }
                disabled={
                  !conferenceSession ||
                  conferenceEnded
                }
                className="rounded-xl border border-red-900 px-5 py-3 font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                End Conference
              </button>

              <div className="ml-auto rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold">
                {conferenceEnded
                  ? "ENDED"
                  : conferenceStatus}
              </div>
            </div>

            {conferenceError && (
              <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
                {conferenceError}
              </div>
            )}
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <TranscriptBox
              title={
                "Original - " +
                (activeSegment
                  ?.sourceLanguage === "es"
                  ? "Spanish"
                  : "English")
              }
              text={
                activeSegment
                  ?.originalText ?? ""
              }
              placeholder="Waiting for speech..."
            />

            <TranscriptBox
              title={
                "Translation - " +
                (activeSegment
                  ?.targetLanguage === "en"
                  ? "English"
                  : "Spanish")
              }
              text={
                activeSegment
                  ?.translatedText ?? ""
              }
              placeholder="Translation will appear here..."
            />
          </section>

          <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Session Memory
                </div>

                <h2 className="mt-1 text-2xl font-bold">
                  {conferenceSession
                    ?.title ??
                    "No active conference"}
                </h2>
              </div>

              <div className="text-sm text-slate-400">
                {conferenceSession
                  ?.segments.length ??
                  0}{" "}
                segment(s)
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {conferenceSession &&
              conferenceSession.segments
                .length > 0 ? (
                conferenceSession.segments.map(
                  (segment, index) => (
                    <article
                      key={segment.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                            Segment{" "}
                            {index + 1}
                          </div>

                          <div className="mt-1 font-semibold">
                            {segment.speaker}
                          </div>
                        </div>

                        <div className="text-xs uppercase text-slate-500">
                          {segment.sourceLanguage}{" "}
                          to{" "}
                          {segment.targetLanguage}
                          {" - "}
                          {segment.endedAt
                            ? "CLOSED"
                            : "LIVE"}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-slate-500">
                            Original
                          </div>

                          <p className="mt-2 whitespace-pre-wrap text-slate-200">
                            {segment.originalText ||
                              "Waiting for speech..."}
                          </p>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-widest text-slate-500">
                            Translation
                          </div>

                          <p className="mt-2 whitespace-pre-wrap text-slate-200">
                            {segment.translatedText ||
                              "Waiting for translation..."}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                )
              ) : (
                <p className="text-slate-500">
                  Start the conference to create the first persistent segment.
                </p>
              )}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Technical Glossary
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {TECHNICAL_GLOSSARY.map(
                (entry) => (
                  <span
                    key={
                      entry.canonical
                    }
                    className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                  >
                    {entry.canonical}
                  </span>
                )
              )}
            </div>
          </section>

          <footer className="mt-6 text-sm text-slate-500">
            H5 - Persistent conference session - Gemini Live - PCM 16 kHz
          </footer>
        </div>
      </main>
    );
  }

  const activeConversationSegment =
    conversationSession?.segments.find(
      (segment) =>
        segment.id ===
        activeConversationSegmentId
    );

  const conversationEnded =
    conversationSession?.endedAt != null;

  const conversationSourceLanguage:
    LanguageCode =
      conversationSpeaker === "A"
        ? "en"
        : "es";

  const conversationTargetLanguage:
    LanguageCode =
      conversationSourceLanguage === "en"
        ? "es"
        : "en";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() =>
              setAppView("home")
            }
            disabled={conversationActive}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back to Mode Selection
          </button>

          <div className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Conversation Mode
          </div>
        </div>

        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Nerdearla Vibeathon 2026
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Bilingual Conversation
          </h1>

          <p className="mt-3 text-slate-400">
            Persistent turn-by-turn English and Spanish conversation.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="grid gap-5 md:grid-cols-2">
            <div
              className={
                conversationSpeaker === "A"
                  ? "rounded-2xl border border-cyan-500 bg-slate-950 p-5"
                  : "rounded-2xl border border-slate-800 bg-slate-950 p-5"
              }
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                Speaker A
              </div>

              <div className="mt-2 text-xl font-bold">
                English
              </div>

              <div className="mt-1 text-sm text-slate-400">
                Translated live to Spanish
              </div>

              {conversationSpeaker === "A" &&
                !conversationEnded && (
                  <div className="mt-4 inline-flex rounded-full border border-cyan-700 px-3 py-1 text-xs font-semibold text-cyan-300">
                    CURRENT TURN
                  </div>
                )}
            </div>

            <div
              className={
                conversationSpeaker === "B"
                  ? "rounded-2xl border border-emerald-500 bg-slate-950 p-5"
                  : "rounded-2xl border border-slate-800 bg-slate-950 p-5"
              }
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Speaker B
              </div>

              <div className="mt-2 text-xl font-bold">
                Spanish
              </div>

              <div className="mt-1 text-sm text-slate-400">
                Translated live to English
              </div>

              {conversationSpeaker === "B" &&
                !conversationEnded && (
                  <div className="mt-4 inline-flex rounded-full border border-emerald-700 px-3 py-1 text-xs font-semibold text-emerald-300">
                    CURRENT TURN
                  </div>
                )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                startConversationTurn()
              }
              disabled={
                conversationActive ||
                conversationEnded
              }
              className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {conversationEnded
                ? "Conversation Ended"
                : conversationSession
                  ? `Resume Speaker ${conversationSpeaker}`
                  : `Start Speaker ${conversationSpeaker}`}
            </button>

            <button
              type="button"
              onClick={
                pauseConversationTurn
              }
              disabled={
                !conversationActive
              }
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Pause Turn
            </button>

            <button
              type="button"
              onClick={
                switchConversationTurn
              }
              disabled={
                conversationEnded
              }
              className="rounded-xl border border-cyan-800 px-5 py-3 font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Switch to Speaker {conversationSpeaker === "A" ? "B" : "A"}
            </button>

            <button
              type="button"
              onClick={endConversation}
              disabled={
                !conversationSession ||
                conversationEnded
              }
              className="rounded-xl border border-red-900 px-5 py-3 font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              End Conversation
            </button>

            <div className="ml-auto rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold">
              {conversationEnded
                ? "ENDED"
                : conversationStatus}
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-400">
            Current direction:{" "}
            <span className="font-semibold text-white">
              {conversationSourceLanguage.toUpperCase()}
              {" -> "}
              {conversationTargetLanguage.toUpperCase()}
            </span>
          </div>

          {conversationError && (
            <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {conversationError}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Original - {activeConversationSegment
                ? activeConversationSegment.sourceLanguage === "en"
                  ? "English"
                  : "Spanish"
                : conversationSourceLanguage === "en"
                  ? "English"
                  : "Spanish"}
            </div>

            <div className="mt-4 min-h-24 text-lg font-semibold leading-7">
              {activeConversationSegment?.originalText ||
                "Original speech will appear here..."}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Translation - {activeConversationSegment
                ? activeConversationSegment.targetLanguage === "en"
                  ? "English"
                  : "Spanish"
                : conversationTargetLanguage === "en"
                  ? "English"
                  : "Spanish"}
            </div>

            <div className="mt-4 min-h-24 text-lg font-semibold leading-7">
              {activeConversationSegment?.translatedText ||
                "Live translation will appear here..."}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Conversation Memory
              </div>

              <h2 className="mt-1 text-2xl font-bold">
                Complete Conversation
              </h2>
            </div>

            <div className="text-sm text-slate-400">
              {conversationSession
                ?.segments.length ?? 0}{" "}
              turn(s)
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {!conversationSession ||
            conversationSession.segments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-slate-500">
                No conversation turns yet.
              </div>
            ) : (
              conversationSession.segments.map(
                (segment, index) => (
                  <article
                    key={segment.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                          Turn {index + 1}
                        </div>

                        <div className="mt-1 font-semibold">
                          {segment.speaker}
                        </div>
                      </div>

                      <div className="text-xs uppercase text-slate-500">
                        {segment.sourceLanguage}
                        {" -> "}
                        {segment.targetLanguage}
                        {" - "}
                        {segment.endedAt
                          ? "CLOSED"
                          : "LIVE"}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">
                          Original
                        </div>

                        <div className="mt-2 leading-7 text-slate-200">
                          {segment.originalText ||
                            "..."}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">
                          Translation
                        </div>

                        <div className="mt-2 leading-7 text-slate-200">
                          {segment.translatedText ||
                            "..."}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              )
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Technical Glossary
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {TECHNICAL_GLOSSARY.map(
              (entry) => (
                <span
                  key={entry.canonical}
                  className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                >
                  {entry.canonical}
                </span>
              )
            )}
          </div>
        </section>

        <footer className="mt-6 text-sm text-slate-500">
          H5 - Persistent bilingual conversation - Gemini Live - PCM 16 kHz
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
