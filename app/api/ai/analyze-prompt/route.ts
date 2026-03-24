import { NextRequest, NextResponse } from "next/server";
import { analyzeSchema, isAIProviderAvailable } from "@/lib/ai/aiService";
import { aggregateScore } from "@/lib/scoring/scoreAggregator";

const ANALYZE_TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS ?? 45000);

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function toAIBreakdown(score: number) {
  // Keep UI contract stable even when provider returns only a single score.
  const perBucket = Math.round(score / 4);
  return {
    specificity: perBucket,
    relationshipClarity: perBucket,
    constraintsAndRules: perBucket,
    realWorldCompleteness: score - perBucket * 3,
  };
}

function buildFallbackScorePayload(
  ruleScore: ReturnType<typeof aggregateScore> | null,
) {
  const fallbackAiScore = ruleScore?.ruleScore ?? null;
  return {
    ruleScore,
    aiScore: fallbackAiScore,
    aiBreakdown:
      typeof fallbackAiScore === "number"
        ? toAIBreakdown(fallbackAiScore)
        : null,
    fallback: true,
    aiDerivedFromRule: true,
  };
}

function pickScore(payload: {
  score?: number;
  aiScore?: number;
  overallScore?: number;
  clarityScore?: number;
}): number | null {
  if (typeof payload.aiScore === "number") return payload.aiScore;
  if (typeof payload.score === "number") return payload.score;
  if (typeof payload.overallScore === "number") return payload.overallScore;
  if (typeof payload.clarityScore === "number") return payload.clarityScore;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, schema } = body;

    if (!prompt && !schema) {
      return NextResponse.json(
        { error: "Provide either 'prompt' or 'schema' field" },
        { status: 400 },
      );
    }

    // Rule-based score (always runs, fast)
    const ruleScore = prompt ? aggregateScore(prompt) : null;

    if (!isAIProviderAvailable()) {
      // Return rule-based score without AI
      return NextResponse.json(buildFallbackScorePayload(ruleScore));
    }

    const result = await withTimeout(
      analyzeSchema(schema ?? prompt),
      ANALYZE_TIMEOUT_MS,
    );

    if (!result) {
      return NextResponse.json(
        {
          error: "AI analysis timed out or failed. Returning rule-based score.",
          ...buildFallbackScorePayload(ruleScore),
        },
        { status: 200 },
      );
    }

    const parsed = (result ?? {}) as {
      score?: number;
      aiScore?: number;
      overallScore?: number;
      clarityScore?: number;
      aiBreakdown?: {
        specificity: number;
        relationshipClarity: number;
        constraintsAndRules: number;
        realWorldCompleteness: number;
      };
      suggestions?: string[];
      issues?: unknown[];
      summary?: string;
    };

    const aiScore = pickScore(parsed);

    const aiBreakdown =
      parsed.aiBreakdown ??
      (typeof aiScore === "number" ? toAIBreakdown(aiScore) : null);

    return NextResponse.json({
      ...parsed,
      ruleScore,
      aiScore: aiScore ?? ruleScore?.ruleScore ?? null,
      aiBreakdown:
        aiBreakdown ??
        (typeof (ruleScore?.ruleScore ?? null) === "number"
          ? toAIBreakdown(ruleScore!.ruleScore)
          : null),
      aiDerivedFromRule: aiScore == null,
    });
  } catch (error) {
    console.error("analyze-prompt error:", error);
    return NextResponse.json(
      { error: "Internal server error", fallback: true },
      { status: 500 },
    );
  }
}
