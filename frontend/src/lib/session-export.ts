import type {
  TranscriptSegment,
  TranscriptSession,
} from "./session-memory";

export type ExportFormat =
  | "txt"
  | "srt"
  | "vtt";

export type ExportContent =
  | "original"
  | "translation"
  | "bilingual";

export type SessionExportOptions = {
  format: ExportFormat;
  content: ExportContent;
  segmentIds?: string[];
};

function selectedSegments(
  session: TranscriptSession,
  segmentIds?: string[]
): TranscriptSegment[] {
  if (
    !segmentIds ||
    segmentIds.length === 0
  ) {
    return session.segments;
  }

  const selected =
    new Set(segmentIds);

  return session.segments.filter(
    (segment) =>
      selected.has(segment.id)
  );
}

function cleanText(
  value: string
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function segmentText(
  segment: TranscriptSegment,
  content: ExportContent
): string {
  const original =
    cleanText(segment.originalText);

  const translation =
    cleanText(segment.translatedText);

  if (content === "original") {
    return original;
  }

  if (content === "translation") {
    return translation;
  }

  const parts: string[] = [];

  if (original) {
    parts.push(
      `Original: ${original}`
    );
  }

  if (translation) {
    parts.push(
      `Translation: ${translation}`
    );
  }

  return parts.join("\n");
}

function parseTime(
  value: string | null,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed =
    Date.parse(value);

  return Number.isNaN(parsed)
    ? fallback
    : parsed;
}

function relativeTiming(
  session: TranscriptSession,
  segment: TranscriptSegment,
  index: number
): {
  startMs: number;
  endMs: number;
} {
  const sessionStart =
    parseTime(
      session.startedAt,
      0
    );

  const fallbackStart =
    sessionStart +
    index * 5000;

  const absoluteStart =
    parseTime(
      segment.startedAt,
      fallbackStart
    );

  const absoluteEnd =
    parseTime(
      segment.endedAt,
      absoluteStart + 4000
    );

  const startMs =
    Math.max(
      0,
      absoluteStart - sessionStart
    );

  const endMs =
    Math.max(
      startMs + 500,
      absoluteEnd - sessionStart
    );

  return {
    startMs,
    endMs,
  };
}

function pad(
  value: number,
  width = 2
): string {
  return String(value).padStart(
    width,
    "0"
  );
}

function subtitleTimestamp(
  milliseconds: number,
  separator: "," | "."
): string {
  const safe =
    Math.max(
      0,
      Math.floor(milliseconds)
    );

  const hours =
    Math.floor(
      safe / 3600000
    );

  const minutes =
    Math.floor(
      (safe % 3600000) / 60000
    );

  const seconds =
    Math.floor(
      (safe % 60000) / 1000
    );

  const millis =
    safe % 1000;

  return (
    `${pad(hours)}:` +
    `${pad(minutes)}:` +
    `${pad(seconds)}` +
    separator +
    pad(millis, 3)
  );
}

function exportTxt(
  session: TranscriptSession,
  segments: TranscriptSegment[],
  content: ExportContent
): string {
  const lines: string[] = [
    session.title,
    `Mode: ${session.mode}`,
    `Started: ${session.startedAt}`,
    `Ended: ${session.endedAt ?? "Open"}`,
    "",
  ];

  segments.forEach(
    (segment, index) => {
      lines.push(
        `Segment ${index + 1}`,
        `Speaker: ${segment.speaker}`,
        `Direction: ${segment.sourceLanguage.toUpperCase()} -> ${segment.targetLanguage.toUpperCase()}`,
        segmentText(
          segment,
          content
        ),
        ""
      );
    }
  );

  return lines.join("\n").trimEnd() +
    "\n";
}

function exportSrt(
  session: TranscriptSession,
  segments: TranscriptSegment[],
  content: ExportContent
): string {
  const blocks =
    segments
      .map(
        (segment, index) => {
          const text =
            segmentText(
              segment,
              content
            );

          if (!text) {
            return "";
          }

          const timing =
            relativeTiming(
              session,
              segment,
              index
            );

          return [
            String(index + 1),
            `${subtitleTimestamp(
              timing.startMs,
              ","
            )} --> ${subtitleTimestamp(
              timing.endMs,
              ","
            )}`,
            `[${segment.speaker}] ${text}`,
          ].join("\n");
        }
      )
      .filter(Boolean);

  return blocks.join("\n\n") +
    (blocks.length ? "\n" : "");
}

function exportVtt(
  session: TranscriptSession,
  segments: TranscriptSegment[],
  content: ExportContent
): string {
  const blocks =
    segments
      .map(
        (segment, index) => {
          const text =
            segmentText(
              segment,
              content
            );

          if (!text) {
            return "";
          }

          const timing =
            relativeTiming(
              session,
              segment,
              index
            );

          return [
            `${subtitleTimestamp(
              timing.startMs,
              "."
            )} --> ${subtitleTimestamp(
              timing.endMs,
              "."
            )}`,
            `[${segment.speaker}] ${text}`,
          ].join("\n");
        }
      )
      .filter(Boolean);

  return [
    "WEBVTT",
    "",
    ...blocks.flatMap(
      (block) => [
        block,
        "",
      ]
    ),
  ].join("\n");
}

export function exportSession(
  session: TranscriptSession,
  options: SessionExportOptions
): string {
  const segments =
    selectedSegments(
      session,
      options.segmentIds
    );

  if (options.format === "txt") {
    return exportTxt(
      session,
      segments,
      options.content
    );
  }

  if (options.format === "srt") {
    return exportSrt(
      session,
      segments,
      options.content
    );
  }

  return exportVtt(
    session,
    segments,
    options.content
  );
}

export function sessionExportFilename(
  session: TranscriptSession,
  format: ExportFormat
): string {
  const safeTitle =
    session.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "transcript";

  return `${safeTitle}.${format}`;
}

export function sessionExportMimeType(
  format: ExportFormat
): string {
  if (format === "srt") {
    return "application/x-subrip;charset=utf-8";
  }

  if (format === "vtt") {
    return "text/vtt;charset=utf-8";
  }

  return "text/plain;charset=utf-8";
}
