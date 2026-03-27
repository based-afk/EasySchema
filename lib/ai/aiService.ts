// ─── AI Service — Main Pipeline Orchestrator ────────────────────────────────
//
// Pipeline order (performance rules enforced):
//   1. Normalize prompt
//   2. Check DB prompt cache (sha256)
//   3. Check rule engine / template bypass
//   4. Load template if matched
//   5. Expand entities
//   6. Call Groq AI with refined prompt
//   7. Infer constraints + relationships
//   8. Run query analysis
//   9. Build intelligence report
//  10. Write to DB cache
//  11. Return ReactFlow nodes + edges
// ─────────────────────────────────────────────────────────────────────────────

import {
  getAIClient,
  getAIProvider,
  isAIProviderAvailable,
} from "./clientFactory";
import { groqChatJson, isGroqAvailable } from "./groqClient";
import type { GroqMessage } from "./groqClient";
import { normalizePrompt } from "../utils/promptNormalizer";
import { scorePrompt } from "../scoring/ruleEngine";
import { detectTemplates } from "../templates/templateDetector";
import { loadTemplate } from "../templates/templateLoader";
import { expandEntities } from "../expansion/entityExpansion";
import { inferConstraints } from "../intelligence/constraintInference";
import { inferRelationships } from "../intelligence/patternInference";
import { generateNormalizationHints } from "../intelligence/normalizationHints";
import { generateIndexSuggestions } from "../intelligence/indexSuggestions";
import { analyzeQueryPatterns } from "../queryAnalysis/queryPatterns";
import { detectJoinComplexity } from "../queryAnalysis/joinComplexity";
import { detectNPlusOne } from "../queryAnalysis/nPlusOneDetection";
import { promptCacheGet, promptCacheSet } from "../cache/promptCache";
import {
  validateCompletenessOfSchema,
  generateCorrectivePrompt,
} from "../completeness/schemaValidator";
import type { ReactFlowSchema, SchemaNode, SchemaEdge } from "./types";

export { isAIProviderAvailable };

async function chatJsonWithFallback<T>(
  messages: GroqMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<T | null> {
  const provider = getAIProvider();
  const primary = await getAIClient().chatJson<T>(messages, options);
  if (primary || provider !== "local") {
    return primary;
  }

  if (!isGroqAvailable()) {
    return primary;
  }

  console.warn("[AI] Local provider failed; falling back to Groq.");
  return groqChatJson<T>(messages, options);
}

// ─── Public task types ────────────────────────────────────────────────────────

export type AITask =
  | "generate"
  | "analyze"
  | "refine"
  | "review"
  | "intelligence";

// ─── ReactFlow schema shape (returned to frontend) ───────────────────────────

export interface GenerateResult {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  meta?: {
    cacheHit: boolean;
    cacheTier?: string;
    templateMatched?: string[];
    promptScore?: number;
    normalizationHints?: string[];
    indexSuggestions?: string[];
    queryWarnings?: string[];
    nPlusOneRisks?: string[];
    completeness?: {
      isComplete: boolean;
      requestedEntities: string[];
      generatedTables: string[];
      missingTables: string[];
      matchPercentage: number;
      correctionAttempts?: number;
    };
  };
}

// ─── System prompts ───────────────────────────────────────────────────────────

function buildGenerateSystemPrompt(): string {
  return `You are an expert database architect. Generate a complete PostgreSQL database schema.

OUTPUT FORMAT (strict JSON only — no prose, no markdown):
{
  "nodes": [
    {
      "id": "<table_name>",
      "type": "tableNode",
      "position": { "x": <number>, "y": <number> },
      "data": {
        "label": "<TableName>",
        "columns": [
          {
            "id": "<col_id>",
            "name": "<column_name>",
            "type": "<SERIAL|INT|BIGINT|TEXT|VARCHAR|BOOLEAN|DATE|TIMESTAMP|FLOAT|DECIMAL|JSON|UUID>",
            "isPrimaryKey": <boolean>,
            "isForeignKey": <boolean>,
            "isNullable": <boolean>,
            "isUnique": <boolean>,
            "defaultValue": "<optional>"
          }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "<edge_id>",
      "source": "<source_table_id>",
      "target": "<target_table_id>",
      "sourceHandle": "<source_col_id>",
      "targetHandle": "<target_col_id>",
      "type": "relationshipEdge",
      "data": {
        "relationshipType": "<one-to-one|one-to-many|many-to-many>",
        "onDelete": "<CASCADE|SET NULL|RESTRICT|NO ACTION>"
      }
    }
  ]
}

Rules:
- Every table MUST have a primary key (SERIAL or UUID id column).
- Foreign keys must reference valid table IDs.
- Position tables in a grid layout (x: 0,350,700,1050... y: 0,400,800...).
- Include created_at TIMESTAMPTZ column on all main tables.
- Normalize to 3NF.
- Return ONLY the JSON object.`;
}

function buildAnalyzeSystemPrompt(): string {
  return `You are a database schema analyst. Analyze the provided schema and return a JSON report.

Return ONLY:
{
  "score": <0-100>,
  "issues": [{ "severity": "error|warning|info", "message": "<string>", "table": "<optional>" }],
  "suggestions": ["<string>"],
  "summary": "<one paragraph>"
}`;
}

function buildRefineSystemPrompt(): string {
  return `You are a database design advisor. Improve the user's prompt to be more precise and complete for schema generation.

Return ONLY:
{
  "refinedPrompt": "<improved prompt>",
  "additions": ["<what was added>"],
  "clarityScore": <0-100>
}`;
}

function buildReviewSystemPrompt(): string {
  return `You are an expert database reviewer. Review the schema and provide actionable feedback.

Return ONLY:
{
  "overallScore": <0-100>,
  "strengths": ["<string>"],
  "weaknesses": ["<string>"],
  "recommendations": ["<string>"],
  "normalFormLevel": "<1NF|2NF|3NF|BCNF>"
}`;
}

// ─── Generate Schema (main pipeline) ─────────────────────────────────────────

export async function generateSchemaFromPrompt(
  rawPrompt: string,
): Promise<GenerateResult | null> {
  // Step 1: Normalize
  const normalized = normalizePrompt(rawPrompt);

  // Step 2: DB prompt cache check
  const cached = await promptCacheGet(normalized, "generate");
  if (cached) {
    const cachedResult = cached as GenerateResult;
    return {
      ...cachedResult,
      meta: {
        ...(cachedResult.meta ?? {}),
        cacheHit: true,
        cacheTier: "db",
        promptScore: cachedResult.meta?.promptScore ?? 0,
      },
    };
  }

  // Step 3: Rule engine score
  const ruleScore = scorePrompt(rawPrompt);
  if (ruleScore.score < 10) {
    return null; // Prompt too weak — reject early
  }

  // Step 4: Template detection
  const matchedTemplates = detectTemplates(rawPrompt);
  let templateBase: Partial<GenerateResult> | null = null;
  if (matchedTemplates.length > 0) {
    templateBase = loadTemplate(matchedTemplates);
  }

  // Step 5: Entity expansion
  const expandedEntities = expandEntities(rawPrompt);

  // Step 6: Build enriched prompt for AI
  const expandedNote =
    expandedEntities.length > 0
      ? `\n\nAlso include expanded entities: ${expandedEntities.join(", ")}.`
      : "";

  const templateNote =
    matchedTemplates.length > 0
      ? `\n\nBase this on a ${matchedTemplates.join(" + ")} schema pattern.`
      : "";

  const enrichedPrompt = `${rawPrompt}${templateNote}${expandedNote}`;

  // If template gives a full schema, use it as a seed and refine with AI
  const messages: GroqMessage[] = [
    { role: "system", content: buildGenerateSystemPrompt() },
    {
      role: "user",
      content: templateBase
        ? `Refine and expand this schema for: ${enrichedPrompt}\n\nSeed schema:\n${JSON.stringify(templateBase)}`
        : `Generate a complete database schema for: ${enrichedPrompt}`,
    },
  ];

  // Step 7: AI call
  const aiResult = await chatJsonWithFallback<GenerateResult>(messages, {
    temperature: 0.2,
    maxTokens: 16384,
  });

  if (!aiResult || !aiResult.nodes) return null;

  // Step 8.5: Validate completeness (new!) — check if all requested entities are present
  let completenessReport = validateCompletenessOfSchema(
    rawPrompt,
    aiResult.nodes,
  );
  let correctionAttempts = 0;

  // Auto-correct if incomplete and under attempt limit
  const MAX_CORRECTIONS = 1; // Try once to correct missing tables
  if (!completenessReport.isComplete && correctionAttempts < MAX_CORRECTIONS) {
    console.log(
      `⚠️  Schema incomplete (${completenessReport.matchPercentage.toFixed(0)}% match). Attempting auto-correction...`,
    );

    const correctivePrompt = generateCorrectivePrompt(
      rawPrompt,
      completenessReport,
    );
    const correctionMessages: GroqMessage[] = [
      { role: "system", content: buildGenerateSystemPrompt() },
      {
        role: "user",
        content: correctivePrompt,
      },
    ];

    const correctedResult = await chatJsonWithFallback<GenerateResult>(
      correctionMessages,
      {
        temperature: 0.2,
        maxTokens: 16384,
      },
    );

    if (correctedResult?.nodes) {
      // Validate the corrected result
      const updatedReport = validateCompletenessOfSchema(
        rawPrompt,
        correctedResult.nodes,
      );

      if (
        updatedReport.isComplete ||
        updatedReport.matchPercentage > completenessReport.matchPercentage
      ) {
        // Use corrected result
        Object.assign(aiResult, correctedResult);
        completenessReport = updatedReport;
        correctionAttempts++;

        console.log(
          `✅ Auto-correction successful! Match improved to ${completenessReport.matchPercentage.toFixed(0)}%`,
        );
      }
    }
  }

  // Step 8: Post-process — constraint + relationship inference
  const constraints = inferConstraints(aiResult.nodes);
  const extraEdges = inferRelationships(aiResult.nodes, aiResult.edges ?? []);

  // Step 9: Intelligence layers
  const normalizationHints = generateNormalizationHints(aiResult.nodes);
  const indexSuggestions = generateIndexSuggestions(
    aiResult.nodes,
    aiResult.edges ?? [],
  );
  const queryWarnings = analyzeQueryPatterns(
    aiResult.nodes,
    aiResult.edges ?? [],
  );
  const joinComplexity = detectJoinComplexity(aiResult.edges ?? []);
  const nPlusOneRisks = detectNPlusOne(aiResult.nodes, aiResult.edges ?? []);

  const result: GenerateResult = {
    nodes: aiResult.nodes,
    edges: [...(aiResult.edges ?? []), ...extraEdges],
    meta: {
      cacheHit: false,
      templateMatched:
        matchedTemplates.length > 0 ? matchedTemplates : undefined,
      promptScore: ruleScore.score,
      normalizationHints,
      indexSuggestions,
      queryWarnings: [...queryWarnings, ...joinComplexity],
      nPlusOneRisks,
      completeness: {
        isComplete: completenessReport.isComplete,
        requestedEntities: completenessReport.requestedEntities,
        generatedTables: completenessReport.generatedTables,
        missingTables: completenessReport.missingTables,
        matchPercentage: completenessReport.matchPercentage,
        correctionAttempts,
      },
    },
  };

  // Apply inferred constraints to edges
  if (constraints.length > 0) {
    result.edges = result.edges.map((edge) => {
      const constraint = constraints.find(
        (c) => c.sourceTable === edge.source && c.targetTable === edge.target,
      );
      if (constraint && edge.data) {
        edge.data.onDelete = constraint.onDelete;
      }
      return edge;
    });
  }

  // Step 10: Write to DB cache
  await promptCacheSet(normalized, "generate", result);

  return result;
}

// ─── Analyze Schema ───────────────────────────────────────────────────────────

export async function analyzeSchema(
  schemaJson: unknown,
): Promise<unknown | null> {
  const cached = await promptCacheGet(JSON.stringify(schemaJson), "analyze");
  if (cached) return cached;

  const messages: GroqMessage[] = [
    { role: "system", content: buildAnalyzeSystemPrompt() },
    {
      role: "user",
      content: `Analyze this schema:\n${JSON.stringify(schemaJson, null, 2)}`,
    },
  ];

  const result = await chatJsonWithFallback(messages, {
    temperature: 0.1,
    maxTokens: 600,
  });
  if (result)
    await promptCacheSet(JSON.stringify(schemaJson), "analyze", result);
  return result;
}

// ─── Refine Prompt ────────────────────────────────────────────────────────────

export async function refinePrompt(rawPrompt: string): Promise<unknown | null> {
  const cached = await promptCacheGet(rawPrompt, "refine");
  if (cached) return cached;

  const messages: GroqMessage[] = [
    { role: "system", content: buildRefineSystemPrompt() },
    {
      role: "user",
      content: `Improve this database design prompt: "${rawPrompt}"`,
    },
  ];

  const result = await chatJsonWithFallback(messages, {
    temperature: 0.4,
    maxTokens: 1024,
  });
  if (result) await promptCacheSet(rawPrompt, "refine", result);
  return result;
}

// ─── Review Schema ────────────────────────────────────────────────────────────

export async function reviewSchema(
  schemaJson: unknown,
  context?: string,
): Promise<unknown | null> {
  const cacheKey = JSON.stringify(schemaJson) + (context ?? "");
  const cached = await promptCacheGet(cacheKey, "review");
  if (cached) return cached;

  const userContent = context
    ? `Review this schema for a ${context} application:\n${JSON.stringify(schemaJson, null, 2)}`
    : `Review this database schema:\n${JSON.stringify(schemaJson, null, 2)}`;

  const messages: GroqMessage[] = [
    { role: "system", content: buildReviewSystemPrompt() },
    { role: "user", content: userContent },
  ];

  const result = await chatJsonWithFallback(messages, {
    temperature: 0.2,
    maxTokens: 2048,
  });
  if (result) await promptCacheSet(cacheKey, "review", result);
  return result;
}
