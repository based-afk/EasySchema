import { NextRequest, NextResponse } from "next/server";
import { analyzePrompt, isAIAvailable } from "@/lib/ai";

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
        { error: "OPENAI_API_KEY not configured", fallback: true },
        { status: 503 },
      );
    }

    const result = await analyzePrompt(prompt);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to parse AI response", fallback: true },
        { status: 500 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("analyze-prompt error:", error);
    return NextResponse.json(
      { error: "Internal server error", fallback: true },
      { status: 500 },
    );
  }
}
