import { NextRequest, NextResponse } from "next/server";
import {
  generateSchemaFromPrompt,
  isAIProviderAvailable,
} from "@/lib/ai/aiService";
import { scorePrompt } from "@/lib/scoring/ruleEngine";

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

    // Rule engine pre-check
    const ruleScore = scorePrompt(prompt);
    if (ruleScore.score < 10) {
      return NextResponse.json(
        {
          error: "Prompt is too vague to generate a useful schema.",
          suggestions: ruleScore.suggestions,
          promptScore: ruleScore.score,
          fallback: true,
        },
        { status: 422 },
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

    const result = await generateSchemaFromPrompt(prompt);

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
