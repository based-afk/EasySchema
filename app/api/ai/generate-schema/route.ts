import { NextRequest, NextResponse } from "next/server";
import { generateSchema, isAIAvailable } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'prompt' field" },
        { status: 400 },
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY not configured", fallback: true },
        { status: 503 },
      );
    }

    const result = await generateSchema(prompt);

    if (!result) {
      return NextResponse.json(
        {
          error:
            "AI generation failed. This may be due to rate limiting — please wait a moment and try again.",
          fallback: true,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("generate-schema error:", error);
    return NextResponse.json(
      { error: "Internal server error", fallback: true },
      { status: 500 },
    );
  }
}
