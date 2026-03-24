// ─── Score Aggregator ─────────────────────────────────────────────────────────
//
// Combines rule-based score with AI score (if available).
// When AI is available: Final = 40% rule + 60% AI
// When AI is unavailable: Final = 100% rule
// ─────────────────────────────────────────────────────────────────────────────

import { scorePrompt, type RuleScore } from "./ruleEngine";

export interface AggregatedScore {
  finalScore: number;
  ruleScore: number;
  aiScore: number | null;
  breakdown: RuleScore["breakdown"];
  suggestions: string[];
  label: "poor" | "fair" | "good" | "excellent";
}

function scoreLabel(score: number): AggregatedScore["label"] {
  if (score < 30) return "poor";
  if (score < 55) return "fair";
  if (score < 80) return "good";
  return "excellent";
}

/**
 * Aggregate rule-based and optional AI scores into a final score.
 */
export function aggregateScore(
  rawPrompt: string,
  aiScore: number | null = null,
): AggregatedScore {
  const rule = scorePrompt(rawPrompt);

  let finalScore: number;
  if (aiScore !== null) {
    // Weighted: 40% rule, 60% AI
    finalScore = Math.round(rule.score * 0.4 + aiScore * 0.6);
  } else {
    finalScore = rule.score;
  }

  return {
    finalScore,
    ruleScore: rule.score,
    aiScore,
    breakdown: rule.breakdown,
    suggestions: rule.suggestions,
    label: scoreLabel(finalScore),
  };
}
