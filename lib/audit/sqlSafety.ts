import type { RiskLevel } from "@/lib/audit/fix-types";

export interface SqlSafetyResult {
  safe: boolean;
  requiresManualReview: boolean;
  reason?: string;
  statements: string[];
}

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bTRUNCATE\b/i, reason: "TRUNCATE is destructive" },
  { pattern: /\bDROP\s+TABLE\b/i, reason: "DROP TABLE is destructive" },
  { pattern: /\bDROP\s+COLUMN\b/i, reason: "DROP COLUMN is destructive" },
  {
    pattern: /\bDELETE\b/i,
    reason: "DELETE requires explicit filtering",
  },
  {
    pattern: /\bALTER\s+TABLE\b.*\bDROP\b/i,
    reason: "ALTER DROP is destructive",
  },
];

const MANUAL_REVIEW_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bALTER\s+TABLE\b.*\bRENAME\b/i,
    reason: "Renames can break application dependencies",
  },
  {
    pattern: /\bALTER\s+TABLE\b.*\bALTER\s+COLUMN\b.*\bSET\s+NOT\s+NULL\b/i,
    reason: "NOT NULL may fail if data contains nulls",
  },
  {
    pattern: /\bALTER\s+TABLE\b.*\bADD\s+CONSTRAINT\b/i,
    reason: "New constraints can fail on existing data",
  },
];

export function analyzeSqlSafety(sql: string): SqlSafetyResult {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    for (const rule of BLOCKED_PATTERNS) {
      if (rule.pattern.test(stmt)) {
        return {
          safe: false,
          requiresManualReview: true,
          reason: rule.reason,
          statements,
        };
      }
    }
  }

  for (const stmt of statements) {
    for (const rule of MANUAL_REVIEW_PATTERNS) {
      if (rule.pattern.test(stmt)) {
        return {
          safe: true,
          requiresManualReview: true,
          reason: rule.reason,
          statements,
        };
      }
    }
  }

  return { safe: true, requiresManualReview: false, statements };
}

export function deriveRiskFromSafety(
  safety: SqlSafetyResult,
  fallback: RiskLevel,
): RiskLevel {
  if (!safety.safe) return "manual_review";
  if (safety.requiresManualReview) return "medium";
  return fallback;
}
