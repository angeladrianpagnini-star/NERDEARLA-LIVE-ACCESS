import { GoogleGenAI, Modality } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LanguageCode = "en" | "es";

type TranslationDirection = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

function parseDirection(
  sourceLanguage: unknown,
  targetLanguage: unknown
): TranslationDirection | null {
  if (
    sourceLanguage === "en" &&
    targetLanguage === "es"
  ) {
    return {
      sourceLanguage: "en",
      targetLanguage: "es",
    };
  }

  if (
    sourceLanguage === "es" &&
    targetLanguage === "en"
  ) {
    return {
      sourceLanguage: "es",
      targetLanguage: "en",
    };
  }

  return null;
}

export async function POST(
  request: NextRequest
) {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured",
        },
        { status: 500 }
      );
    }

    let direction: TranslationDirection = {
      sourceLanguage: "en",
      targetLanguage: "es",
    };

    try {
      const body =
        (await request.json()) as {
          sourceLanguage?: unknown;
          targetLanguage?: unknown;
        };

      const hasDirection =
        body.sourceLanguage !== undefined ||
        body.targetLanguage !== undefined;

      if (hasDirection) {
        const parsedDirection =
          parseDirection(
            body.sourceLanguage,
            body.targetLanguage
          );

        if (!parsedDirection) {
          return NextResponse.json(
            {
              error:
                "Unsupported translation direction",
            },
            { status: 400 }
          );
        }

        direction = parsedDirection;
      }
    } catch {
      // Empty body preserves the existing
      // EN -> ES behavior.
    }

    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: "v1beta",
      },
    });

    const expireTime = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    const model =
      "gemini-3.5-live-translate-preview";

    const token =
      await client.authTokens.create({
        config: {
          uses: 1,
          expireTime,

          liveConnectConstraints: {
            model,

            config: {
              responseModalities: [
                Modality.AUDIO,
              ],

              inputAudioTranscription: {},

              outputAudioTranscription: {},

              translationConfig: {
                targetLanguageCode:
                  direction.targetLanguage,

                echoTargetLanguage: true,
              },
            },
          },
        },
      });

    if (!token.name) {
      throw new Error(
        "Gemini did not return an ephemeral translation token"
      );
    }

    return NextResponse.json({
      token: token.name,
      model,
      sourceLanguage:
        direction.sourceLanguage,
      targetLanguage:
        direction.targetLanguage,
    });
  } catch (error) {
    console.error(
      "Translation token provisioning error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to provision Gemini Live translation token",
      },
      { status: 500 }
    );
  }
}