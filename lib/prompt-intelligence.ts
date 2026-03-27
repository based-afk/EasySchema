import {
  PromptAnalysis,
  RuleScoreBreakdown,
  PromptVersion,
} from "./schema-types";

// ─── Prompt Intelligence Engine ─────────────────────────────────────────────
//
// Hybrid scoring: rule-based (local) + AI (GPT, optional).
// Combined score = 40% rule + 60% AI when AI is available, 100% rule otherwise.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Entity keywords (reused from schema-utils but centralized) ─────────────

const ENTITY_KEYWORDS = [
  "user",
  "users",
  "customer",
  "customers",
  "account",
  "accounts",
  "product",
  "products",
  "item",
  "items",
  "order",
  "orders",
  "purchase",
  "purchases",
  "post",
  "posts",
  "article",
  "articles",
  "blog",
  "comment",
  "comments",
  "review",
  "reviews",
  "category",
  "categories",
  "tag",
  "tags",
  "payment",
  "payments",
  "transaction",
  "transactions",
  "inventory",
  "stock",
  "warehouse",
  "class",
  "classes",
  "course",
  "courses",
  "lesson",
  "lessons",
  "teacher",
  "teachers",
  "student",
  "students",
  "assignment",
  "assignments",
  "submission",
  "submissions",
  "message",
  "messages",
  "chat",
  "conversation",
  "team",
  "teams",
  "organization",
  "company",
  "project",
  "projects",
  "task",
  "tasks",
  "file",
  "files",
  "document",
  "documents",
  "address",
  "addresses",
  "location",
  "locations",
  "wishlist",
  "cart",
  "shipping",
  "invoice",
  "invoices",
  "subscription",
  "subscriptions",
  "notification",
  "notifications",
  "role",
  "roles",
  "permission",
  "permissions",
  "session",
  "sessions",
  "log",
  "logs",
  "audit",
  "event",
  "events",
];

const RELATIONSHIP_KEYWORDS = [
  "has",
  "have",
  "belongs to",
  "contains",
  "owns",
  "manages",
  "placed by",
  "created by",
  "assigned to",
  "connected to",
  "references",
  "links to",
  "relates to",
  "part of",
  "who",
  "which",
  "with",
  "their",
  "each",
  "many-to-many",
  "one-to-many",
  "one-to-one",
  "associated with",
  "dependent on",
];

const CONSTRAINT_KEYWORDS = [
  "unique",
  "required",
  "optional",
  "default",
  "not null",
  "index",
  "track",
  "tracking",
  "auto-increment",
  "cascad",
  "restrict",
  "check",
  "validate",
  "enforce",
  "constraint",
  "limit",
  "maximum",
  "minimum",
];

const SCALE_KEYWORDS = [
  "scale",
  "million",
  "thousand",
  "high traffic",
  "concurrent",
  "performance",
  "fast",
  "real-time",
  "large",
  "big",
  "enterprise",
  "production",
  "distributed",
];

const ROLE_KEYWORDS = [
  "admin",
  "administrator",
  "moderator",
  "editor",
  "viewer",
  "owner",
  "manager",
  "staff",
  "superuser",
  "guest",
  "role",
  "roles",
  "permission",
  "permissions",
  "access",
  "authorization",
  "authentication",
  "auth",
];

// ─── Rule-based scoring ─────────────────────────────────────────────────────

function computeRuleScore(description: string): {
  score: number;
  breakdown: RuleScoreBreakdown;
  suggestions: string[];
  detectedEntities: string[];
  detectedRelationships: string[];
} {
  const lower = description.toLowerCase().trim();
  const suggestions: string[] = [];
  const detectedEntities: string[] = [];
  const detectedRelationships: string[] = [];

  if (!lower) {
    return {
      score: 0,
      breakdown: {
        length: 0,
        entities: 0,
        relationships: 0,
        constraints: 0,
        scale: 0,
        roles: 0,
      },
      suggestions: ["Start by describing what your application does."],
      detectedEntities: [],
      detectedRelationships: [],
    };
  }

  // 1. Length (0–15)
  const words = lower.split(/\s+/).length;
  let lengthScore = 0;
  if (words < 5) {
    lengthScore = 2;
    suggestions.push(
      "Add more detail — describe the main things your app manages.",
    );
  } else if (words < 15) {
    lengthScore = 7;
    suggestions.push(
      "Good start. Try mentioning how things relate to each other.",
    );
  } else if (words < 30) {
    lengthScore = 12;
  } else {
    lengthScore = 15;
  }

  // 2. Entities (0–30)
  for (const kw of ENTITY_KEYWORDS) {
    if (lower.includes(kw) && !detectedEntities.includes(kw)) {
      detectedEntities.push(kw);
    }
  }
  let entityScore = 0;
  if (detectedEntities.length === 0) {
    entityScore = 0;
    suggestions.push(
      "Mention the main things your app manages (e.g., users, products, orders).",
    );
  } else if (detectedEntities.length < 3) {
    entityScore = 12;
    suggestions.push("Try adding more entities for a richer schema.");
  } else if (detectedEntities.length < 5) {
    entityScore = 22;
  } else {
    entityScore = 30;
  }

  // 3. Relationships (0–25)
  for (const kw of RELATIONSHIP_KEYWORDS) {
    if (lower.includes(kw) && !detectedRelationships.includes(kw)) {
      detectedRelationships.push(kw);
    }
  }
  let relScore = 0;
  if (detectedRelationships.length === 0) {
    relScore = 0;
    suggestions.push(
      "Describe how things relate (e.g., 'users place orders').",
    );
  } else if (detectedRelationships.length < 2) {
    relScore = 10;
  } else if (detectedRelationships.length < 4) {
    relScore = 18;
  } else {
    relScore = 25;
  }

  // 4. Constraints (0–15)
  let constraintScore = 0;
  const foundConstraints = CONSTRAINT_KEYWORDS.filter((kw) =>
    lower.includes(kw),
  );
  if (foundConstraints.length === 0) {
    if (entityScore > 10) {
      suggestions.push(
        "Consider mentioning constraints (e.g., 'email must be unique').",
      );
    }
  } else if (foundConstraints.length < 2) {
    constraintScore = 7;
  } else {
    constraintScore = 15;
  }

  // 5. Scale (0–8)
  let scaleScore = 0;
  const foundScale = SCALE_KEYWORDS.filter((kw) => lower.includes(kw));
  if (foundScale.length > 0) {
    scaleScore = Math.min(8, foundScale.length * 4);
  }

  // 6. Roles (0–7)
  let rolesScore = 0;
  const foundRoles = ROLE_KEYWORDS.filter((kw) => lower.includes(kw));
  if (foundRoles.length > 0) {
    rolesScore = Math.min(7, foundRoles.length * 3);
  }

  const totalScore = Math.min(
    100,
    lengthScore +
      entityScore +
      relScore +
      constraintScore +
      scaleScore +
      rolesScore,
  );

  if (totalScore >= 70 && suggestions.length === 0) {
    suggestions.push("Looking great! Hit Generate to create your schema.");
  }

  return {
    score: totalScore,
    breakdown: {
      length: lengthScore,
      entities: entityScore,
      relationships: relScore,
      constraints: constraintScore,
      scale: scaleScore,
      roles: rolesScore,
    },
    suggestions,
    detectedEntities,
    detectedRelationships,
  };
}

// ─── Analyze prompt (local rule-based only) ─────────────────────────────────

export function analyzePromptLocal(description: string): PromptAnalysis {
  const result = computeRuleScore(description);
  return {
    ruleScore: result.score,
    ruleBreakdown: result.breakdown,
    aiScore: null,
    aiBreakdown: null,
    combinedScore: result.score,
    suggestions: result.suggestions,
    detectedEntities: result.detectedEntities,
    detectedRelationships: result.detectedRelationships,
  };
}

// ─── Analyze prompt (hybrid: local + AI) ────────────────────────────────────

export async function analyzePromptHybrid(
  description: string,
): Promise<PromptAnalysis> {
  const ruleResult = computeRuleScore(description);
  const local: PromptAnalysis = {
    ruleScore: ruleResult.score,
    ruleBreakdown: ruleResult.breakdown,
    aiScore: null,
    aiBreakdown: null,
    combinedScore: ruleResult.score,
    suggestions: ruleResult.suggestions,
    detectedEntities: ruleResult.detectedEntities,
    detectedRelationships: ruleResult.detectedRelationships,
  };

  try {
    const res = await fetch("/api/ai/analyze-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: description }),
    });

    if (!res.ok) {
      console.warn("analyzePromptHybrid: API returned", res.status);
      return local;
    }

    const data = await res.json();
    console.log("analyzePromptHybrid: API response", data);

    if (data.aiScore != null && data.aiBreakdown) {
      const combined = Math.round(ruleResult.score * 0.4 + data.aiScore * 0.6);
      return {
        ...local,
        aiScore: data.aiScore,
        aiBreakdown: data.aiBreakdown,
        combinedScore: combined,
        aiSuggestions: data.suggestions ?? [],
      };
    }

    console.warn(
      "analyzePromptHybrid: missing aiScore or aiBreakdown in response",
      data,
    );
  } catch (err) {
    console.error("analyzePromptHybrid error:", err);
    // AI unavailable — fall back to rule-only
  }

  return local;
}

// ─── AI Prompt Refiner ──────────────────────────────────────────────────────

export interface RefineResult {
  improved: string;
  changes: string[];
  error?: string;
}

export async function refinePrompt(description: string): Promise<RefineResult> {
  try {
    const res = await fetch("/api/ai/refine-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: description }),
    });

    if (!res.ok) {
      return {
        improved: description,
        changes: [],
        error: "AI service unavailable. Please check your API key.",
      };
    }

    const data = await res.json();
    return {
      improved: data.improved ?? description,
      changes: data.changes ?? [],
    };
  } catch {
    return {
      improved: description,
      changes: [],
      error: "Failed to connect to AI service.",
    };
  }
}

// ─── AI Schema Generation (client-side wrapper) ────────────────────────────

export interface AIGeneratedSchema {
  tables: {
    name: string;
    columns: {
      name: string;
      type: string;
      isPrimaryKey: boolean;
      isForeignKey: boolean;
      isNullable: boolean;
      isUnique: boolean;
      defaultValue?: string;
    }[];
  }[];
  relationships: {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    type: string;
    onDelete: string;
  }[];
  error?: string;
}

export async function generateSchemaAI(
  description: string,
): Promise<AIGeneratedSchema> {
  const requestTimeoutMs = 30_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const res = await fetch("/api/ai/generate-schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: description }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { tables: [], relationships: [], error: "AI service unavailable" };
    }

    const data = await res.json();
    return {
      tables: data.tables ?? [],
      relationships: data.relationships ?? [],
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        tables: [],
        relationships: [],
        error: "AI request timed out",
      };
    }
    return {
      tables: [],
      relationships: [],
      error: "Failed to connect to AI service",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Prompt Version Management ──────────────────────────────────────────────

export function createPromptVersion(
  text: string,
  ruleScore: number,
  aiScore: number | null,
  combinedScore: number,
  isRefined: boolean = false,
): PromptVersion {
  return {
    id: `pv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    ruleScore,
    aiScore,
    combinedScore,
    timestamp: new Date().toISOString(),
    isRefined,
  };
}

// ─── Prompt Improvement Delta ───────────────────────────────────────────────

export function computePromptImprovement(versions: PromptVersion[]): {
  totalImprovement: number;
  averageScore: number;
  bestScore: number;
  versionCount: number;
} {
  if (versions.length === 0) {
    return {
      totalImprovement: 0,
      averageScore: 0,
      bestScore: 0,
      versionCount: 0,
    };
  }

  const scores = versions.map((v) => v.combinedScore);
  const first = scores[0];
  const last = scores[scores.length - 1];
  const totalImprovement = last - first;
  const averageScore = Math.round(
    scores.reduce((a, b) => a + b, 0) / scores.length,
  );
  const bestScore = Math.max(...scores);

  return {
    totalImprovement,
    averageScore,
    bestScore,
    versionCount: versions.length,
  };
}
