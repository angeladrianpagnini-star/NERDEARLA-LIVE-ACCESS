import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
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

    const token = await client.authTokens.create({
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
              targetLanguageCode: "es",
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
      sourceLanguage: "en",
      targetLanguage: "es",
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
