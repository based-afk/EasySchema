import { NextRequest, NextResponse } from "next/server";
import { reviewSchema, isAIProviderAvailable } from "@/lib/ai/aiService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schema } = body;

    if (!schema) {
      return NextResponse.json(
        { error: "Missing 'schema' field" },
        { status: 400 },
      );
    }

    if (!isAIProviderAvailable()) {
      return NextResponse.json(
        {
          error:
            "AI provider not configured. Set up either Groq (GROQ_KEY_*) or local LLM (LOCAL_LLM_URL).",
          fallback: true,
        },
        { status: 503 },
      );
    }

    const result = await reviewSchema(schema);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to parse AI response", fallback: true },
        { status: 500 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("review-schema error:", error);
    return NextResponse.json(
      { error: "Internal server error", fallback: true },
      { status: 500 },
    );
  }
}
