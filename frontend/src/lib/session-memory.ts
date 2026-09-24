export type SessionMode =
  | "conference"
  | "conversation";

export type LanguageCode =
  | "en"
  | "es";

export type TranscriptSegment = {
  id: string;
  speaker: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  startedAt: string;
  endedAt: string | null;
  originalText: string;
  translatedText: string;
};

export type TranscriptSession = {
  id: string;
  mode: SessionMode;
  title: string;
  startedAt: string;
  endedAt: string | null;
  segments: TranscriptSegment[];
};

export function createTranscriptSession(
  mode: SessionMode,
  title: string
): TranscriptSession {
  return {
    id: crypto.randomUUID(),
    mode,
    title,
    startedAt: new Date().toISOString(),
    endedAt: null,
    segments: [],
  };
}

export function createTranscriptSegment(
  speaker: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): TranscriptSegment {
  return {
    id: crypto.randomUUID(),
    speaker,
    sourceLanguage,
    targetLanguage,
    startedAt: new Date().toISOString(),
    endedAt: null,
    originalText: "",
    translatedText: "",
  };
}

export function closeTranscriptSegment(
  segment: TranscriptSegment
): TranscriptSegment {
  return {
    ...segment,
    endedAt: new Date().toISOString(),
  };
}

export function closeTranscriptSession(
  session: TranscriptSession
): TranscriptSession {
  return {
    ...session,
    endedAt: new Date().toISOString(),
  };
}

export function addSegmentToSession(
  session: TranscriptSession,
  segment: TranscriptSegment
): TranscriptSession {
  return {
    ...session,
    segments: [
      ...session.segments,
      segment,
    ],
  };
}

export function updateSegmentInSession(
  session: TranscriptSession,
  segmentId: string,
  update: (
    segment: TranscriptSegment
  ) => TranscriptSegment
): TranscriptSession {
  return {
    ...session,
    segments: session.segments.map(
      (segment) =>
        segment.id === segmentId
          ? update(segment)
          : segment
    ),
  };
}

export function appendOriginalText(
  segment: TranscriptSegment,
  text: string
): TranscriptSegment {
  return {
    ...segment,
    originalText:
      segment.originalText + text,
  };
}

export function appendTranslatedText(
  segment: TranscriptSegment,
  text: string
): TranscriptSegment {
  return {
    ...segment,
    translatedText:
      segment.translatedText + text,
  };
}
