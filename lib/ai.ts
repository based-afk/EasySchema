// ─── Centralized OpenAI Service Layer ────────────────────────────────────────
//
// All GPT interactions go through here.
// Routes should stay thin — they call these functions and return the result.
// ─────────────────────────────────────────────────────────────────────────────

import OpenAI from "openai";

// ─── Client singleton (hot-reload safe) ─────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __openai: OpenAI | undefined;
}

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  if (!global.__openai) {
    global.__openai = new OpenAI({ apiKey: key });
  }
  return global.__openai;
}

export function isAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AIPromptAnalysis {
  aiScore: number;
  aiBreakdown: {
    specificity: number;
    relationshipClarity: number;
    constraintsAndRules: number;
    realWorldCompleteness: number;
  };
  suggestions: string[];
}

export interface AIPromptRefinement {
  improved: string;
  changes: string[];
}

export interface AISchemaReviewIssue {
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  suggestion: string;
}

export interface AISchemaReview {
  overallAssessment: string;
  issues: AISchemaReviewIssue[];
}

export interface AISchemaGeneration {
  tables: unknown[];
  relationships: unknown[];
}

// ─── Prompt Analysis ────────────────────────────────────────────────────────

const ANALYZE_PROMPT_SYSTEM = `You are evaluating the quality of a database design prompt.

Evaluate on:
1. Specificity (0-25) — How specific and detailed is the description?
2. Relationship clarity (0-25) — Are relationships between entities clearly described?
3. Constraints & rules (0-25) — Are business rules, constraints, and validations mentioned?
4. Real-world completeness (0-25) — Does it cover realistic requirements a production app would need?

Return JSON only with this exact structure:
{
  "specificity": <number 0-25>,
  "relationshipClarity": <number 0-25>,
  "constraintsAndRules": <number 0-25>,
  "realWorldCompleteness": <number 0-25>,
  "totalScore": <number 0-100>,
  "suggestions": [<string>, <string>, ...]
}`;

export async function analyzePrompt(
  prompt: string,
): Promise<AIPromptAnalysis | null> {
  const client = getClient();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: ANALYZE_PROMPT_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    aiScore:
      parsed.totalScore ??
      (parsed.specificity ?? 0) +
        (parsed.relationshipClarity ?? 0) +
        (parsed.constraintsAndRules ?? 0) +
        (parsed.realWorldCompleteness ?? 0),
    aiBreakdown: {
      specificity: parsed.specificity ?? 0,
      relationshipClarity: parsed.relationshipClarity ?? 0,
      constraintsAndRules: parsed.constraintsAndRules ?? 0,
      realWorldCompleteness: parsed.realWorldCompleteness ?? 0,
    },
    suggestions: parsed.suggestions ?? [],
  };
}

// ─── Prompt Refinement ──────────────────────────────────────────────────────

const REFINE_PROMPT_SYSTEM = `You are an expert database architect helping users improve their database design prompts.

Given the user's original prompt, rewrite it to be:
- Clearer and more specific about entities
- Explicit about relationships between entities
- Include missing constraints, business rules, and validation
- Mention scale, user roles, and timestamps where relevant
- Use professional database terminology

Return JSON only with this exact structure:
{
  "improved": "<the improved prompt text>",
  "changes": [
    "<brief description of change 1>",
    "<brief description of change 2>"
  ]
}`;

export async function refinePrompt(
  prompt: string,
): Promise<AIPromptRefinement | null> {
  const client = getClient();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: REFINE_PROMPT_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    improved: parsed.improved ?? prompt,
    changes: parsed.changes ?? [],
  };
}

// ─── Schema Review ──────────────────────────────────────────────────────────

const REVIEW_SCHEMA_SYSTEM = `You are an expert database architect reviewing a schema design.

Analyze the provided schema JSON and suggest improvements.
Focus on:
1. Design flaws (normalization issues, missing entities)
2. Better naming conventions
3. Missing constraints or indexes
4. Relationship improvements
5. Performance concerns

Return JSON only with this exact structure:
{
  "overallAssessment": "<1-2 sentence summary>",
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "title": "<short title>",
      "description": "<detailed description>",
      "suggestion": "<actionable fix>"
    }
  ]
}`;

export async function reviewSchema(
  schema: unknown,
): Promise<AISchemaReview | null> {
  const client = getClient();
  if (!client) return null;

  const schemaStr =
    typeof schema === "string" ? schema : JSON.stringify(schema, null, 2);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: REVIEW_SCHEMA_SYSTEM },
      {
        role: "user",
        content: `Review this database schema:\n\n${schemaStr}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    overallAssessment: parsed.overallAssessment ?? "",
    issues: parsed.issues ?? [],
  };
}

// ─── Schema Generation (from prompt) ────────────────────────────────────────

const GENERATE_SCHEMA_SYSTEM = `You are an expert database architect. Given a description, generate a PostgreSQL database schema.

Return JSON only with this exact structure:
{
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {
          "name": "column_name",
          "type": "INT|BIGINT|SERIAL|TEXT|VARCHAR|BOOLEAN|DATE|TIMESTAMP|FLOAT|DECIMAL|JSON|UUID",
          "isPrimaryKey": true/false,
          "isForeignKey": true/false,
          "isNullable": true/false,
          "isUnique": true/false,
          "defaultValue": "optional default"
        }
      ]
    }
  ],
  "relationships": [
    {
      "sourceTable": "table_name",
      "sourceColumn": "column_name",
      "targetTable": "table_name",
      "targetColumn": "column_name",
      "type": "one-to-one|one-to-many|many-to-many",
      "onDelete": "CASCADE|SET NULL|RESTRICT|NO ACTION"
    }
  ]
}`;

export async function generateSchema(
  prompt: string,
): Promise<AISchemaGeneration | null> {
  const client = getClient();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: GENERATE_SCHEMA_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    tables: parsed.tables ?? [],
    relationships: parsed.relationships ?? [],
  };
}
