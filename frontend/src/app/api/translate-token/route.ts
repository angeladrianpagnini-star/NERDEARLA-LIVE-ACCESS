import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LanguageCode = "en" | "es";

type TranslationDirection = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

type GeminiAuthTokenResponse = {
  name?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
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
      // Empty body preserves EN -> ES.
    }

    const expireTime = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    const newSessionExpireTime = new Date(
      Date.now() + 60 * 1000
    ).toISOString();

    const model =
      "gemini-3.5-live-translate-preview";

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          uses: 1,
          expireTime,
          newSessionExpireTime,
        }),
        cache: "no-store",
      }
    );

    const tokenData =
      (await geminiResponse.json()) as
        GeminiAuthTokenResponse;

    if (
      !geminiResponse.ok ||
      !tokenData.name
    ) {
      console.error(
        "Gemini AuthTokenService rejected token request:",
        {
          status: geminiResponse.status,
          error: tokenData.error,
        }
      );

      throw new Error(
        `Gemini AuthTokenService returned ${geminiResponse.status}`
      );
    }

    return NextResponse.json({
      token: tokenData.name,
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