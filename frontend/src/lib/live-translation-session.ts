import {
  GoogleGenAI,
  Modality,
  Session,
} from "@google/genai";

export type LiveSessionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "STREAMING"
  | "FINALIZING"
  | "ERROR";

export type TranslationToken = {
  token: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type LiveTranslationCallbacks = {
  onStatus: (
    status: LiveSessionStatus
  ) => void;

  onOriginalText: (
    text: string
  ) => void;

  onTranslatedText: (
    text: string
  ) => void;

  onError: (
    message: string
  ) => void;

  onChunk?: () => void;
};

function arrayBufferToBase64(
  buffer: ArrayBuffer
): string {
  const bytes =
    new Uint8Array(buffer);

  let binary = "";

  for (
    let i = 0;
    i < bytes.byteLength;
    i++
  ) {
    binary += String.fromCharCode(
      bytes[i]
    );
  }

  return btoa(binary);
}

export class LiveTranslationSession {
  private session:
    | Session
    | null = null;

  private stream:
    | MediaStream
    | null = null;

  private audioContext:
    | AudioContext
    | null = null;

  private worklet:
    | AudioWorkletNode
    | null = null;

  private source:
    | MediaStreamAudioSourceNode
    | null = null;

  private silentGain:
    | GainNode
    | null = null;

  private readonly callbacks:
    LiveTranslationCallbacks;

  constructor(
    callbacks:
      LiveTranslationCallbacks
  ) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    try {
      this.callbacks.onStatus(
        "CONNECTING"
      );

      //
      // Each logical conference session obtains
      // its own constrained ephemeral token.
      //
      const tokenResponse =
        await fetch(
          "/api/translate-token",
          {
            method: "POST",
          }
        );

      if (!tokenResponse.ok) {
        throw new Error(
          `Translation token provisioning failed (${tokenResponse.status})`
        );
      }

      const tokenData =
        (await tokenResponse.json()) as
          TranslationToken;

      if (
        !tokenData.token ||
        !tokenData.model
      ) {
        throw new Error(
          "Invalid translation token response"
        );
      }

      const ai =
        new GoogleGenAI({
          apiKey:
            tokenData.token,

          httpOptions: {
            apiVersion:
              "v1beta",
          },
        });

      this.session =
        await ai.live.connect({
          model:
            tokenData.model,

          config: {
            responseModalities: [
              Modality.AUDIO,
            ],

            inputAudioTranscription:
              {},

            outputAudioTranscription:
              {},

            translationConfig: {
              targetLanguageCode:
                "es",

              echoTargetLanguage:
                true,
            },
          },

          callbacks: {
            onopen: () => {
              this.callbacks.onStatus(
                "CONNECTED"
              );
            },

            onmessage: (
              message
            ) => {
              const content =
                message.serverContent;

              if (!content) {
                return;
              }

              const original =
                content
                  .inputTranscription
                  ?.text;

              if (original) {
                this.callbacks
                  .onOriginalText(
                    original
                  );
              }

              const translated =
                content
                  .outputTranscription
                  ?.text;

              if (translated) {
                this.callbacks
                  .onTranslatedText(
                    translated
                  );
              }
            },

            onerror: (
              event
            ) => {
              this.callbacks.onError(
                event.message ||
                  "Gemini Live translation error"
              );

              this.callbacks.onStatus(
                "ERROR"
              );
            },

            onclose: () => {
              this.callbacks.onStatus(
                "DISCONNECTED"
              );
            },
          },
        });

      //
      // Every instance gets its own browser
      // MediaStream and audio processing graph.
      //
      this.stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation:
                true,
              noiseSuppression:
                true,
              autoGainControl:
                true,
            },
          });

      this.audioContext =
        new AudioContext();

      await this.audioContext
        .audioWorklet
        .addModule(
          "/audio/pcm-processor.js"
        );

      this.source =
        this.audioContext
          .createMediaStreamSource(
            this.stream
          );

      this.worklet =
        new AudioWorkletNode(
          this.audioContext,
          "pcm-processor"
        );

      this.worklet.port
        .onmessage = (
          event
        ) => {
          const pcmBuffer =
            event.data
              .pcm as ArrayBuffer;

          if (
            !pcmBuffer ||
            !this.session
          ) {
            return;
          }

          const base64 =
            arrayBufferToBase64(
              pcmBuffer
            );

          this.session
            .sendRealtimeInput({
              audio: {
                data: base64,

                mimeType:
                  "audio/pcm;rate=16000",
              },
            });

          this.callbacks
            .onChunk?.();

          this.callbacks.onStatus(
            "STREAMING"
          );
        };

      this.source.connect(
        this.worklet
      );

      //
      // Keep AudioWorklet alive while preventing
      // microphone feedback through speakers.
      //
      this.silentGain =
        this.audioContext
          .createGain();

      this.silentGain
        .gain.value = 0;

      this.worklet.connect(
        this.silentGain
      );

      this.silentGain.connect(
        this.audioContext
          .destination
      );
    } catch (error) {
      await this.cleanup();

      const message =
        error instanceof Error
          ? error.message
          : "Unable to start live translation";

      this.callbacks.onError(
        message
      );

      this.callbacks.onStatus(
        "ERROR"
      );

      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.callbacks.onStatus(
        "FINALIZING"
      );

      this.worklet
        ?.disconnect();

      this.worklet = null;

      this.source
        ?.disconnect();

      this.source = null;

      this.silentGain
        ?.disconnect();

      this.silentGain = null;

      this.stream
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop()
        );

      this.stream = null;

      if (
        this.audioContext
      ) {
        await this.audioContext
          .close();

        this.audioContext =
          null;
      }

      const sessionToClose =
        this.session;

      //
      // Detach the instance reference immediately.
      // This makes stop idempotent and prevents
      // asynchronous close events from racing with
      // the final local close operation.
      //
      this.session = null;

      if (sessionToClose) {
        sessionToClose
          .sendRealtimeInput({
            audioStreamEnd:
              true,
          });

        //
        // Give Gemini time to deliver final
        // transcription/translation events.
        //
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              4000
            )
        );

        try {
          sessionToClose.close();
        } catch {
          //
          // The remote side may already have closed
          // after audioStreamEnd. That is a valid
          // terminal state.
          //
        }
      }

      this.callbacks.onStatus(
        "DISCONNECTED"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to stop live translation";

      this.callbacks.onError(
        message
      );

      this.callbacks.onStatus(
        "ERROR"
      );
    }
  }

  private async cleanup():
    Promise<void> {
    try {
      this.worklet
        ?.disconnect();

      this.source
        ?.disconnect();

      this.silentGain
        ?.disconnect();

      this.stream
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop()
        );

      if (
        this.audioContext &&
        this.audioContext.state !==
          "closed"
      ) {
        await this.audioContext
          .close();
      }

      this.session
        ?.close();
    } finally {
      this.worklet = null;
      this.source = null;
      this.silentGain = null;
      this.stream = null;
      this.audioContext = null;
      this.session = null;
    }
  }
}

