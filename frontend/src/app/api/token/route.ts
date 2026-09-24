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

    const client = new GoogleGenAI({ apiKey });

    const expireTime = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        liveConnectConstraints: {
          model: "gemini-3.5-transcribe-live",
          config: {
            responseModalities: [Modality.TEXT],
            inputAudioTranscription: {
              languageCodes: ["es-419"],
            },
          },
        },
      },
    });

    if (!token.name) {
      throw new Error("Gemini did not return an ephemeral token");
    }

    return NextResponse.json({
      token: token.name,
      model: "gemini-3.5-transcribe-live",
    });
  } catch (error) {
    console.error("Token provisioning error:", error);

    return NextResponse.json(
      { error: "Unable to provision Gemini Live token" },
      { status: 500 }
    );
  }
}


