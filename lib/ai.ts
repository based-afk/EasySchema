// Centralized AI Service Layer (Gemini only)
// All API routes depend on these helpers.

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

type AIProvider = { kind: "gemini"; model: GenerativeModel };

declare global {
  // eslint-disable-next-line no-var
  var __gemini: GenerativeModel | undefined;
}

function getProvider(): AIProvider | null {
  const googleKey = process.env.GOOGLE_API_KEY;
  const geminiModelId = process.env.GOOGLE_GEMINI_MODEL || "gemini-2.0-flash";
  if (!googleKey) return null;

  if (!global.__gemini || process.env.NODE_ENV === "development") {
    console.log("[AI] Initializing model:", geminiModelId);
    const genAI = new GoogleGenerativeAI(googleKey);
    global.__gemini = genAI.getGenerativeModel({ model: geminiModelId });
  }

  return { kind: "gemini", model: global.__gemini };
}

export function isAIAvailable(): boolean {
  return !!process.env.GOOGLE_API_KEY;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// Strip markdown code fences (```json ... ```) and trim whitespace.
function stripMarkdownFences(text: string): string {
  return text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

// Attempt to repair truncated JSON by closing open brackets/braces.
function repairTruncatedJson(text: string): string | null {
  // Walk through the string tracking open containers
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  if (stack.length === 0) return null; // not truncated, something else is wrong

  // Trim trailing incomplete value (partial string, number, key, etc.)
  let repaired = text.replace(/,\s*$/, ""); // trailing comma
  // If we're inside a string, close it
  if (inString) repaired += '"';
  // Remove any trailing partial key-value like `"foo":` or `"foo": "bar`
  repaired = repaired.replace(/,?\s*"[^"]*"\s*:\s*"?[^"{}\[\]]*$/, "");
  repaired = repaired.replace(/,\s*$/, "");

  // Close all open containers in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === "{" ? "}" : "]";
  }

  return repaired;
}

// Extract the first JSON object from a text blob; tolerant of extra text & truncation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonObject(content: string): any | null {
  if (!content) return null;

  // Strip markdown code fences first
  const cleaned = stripMarkdownFences(content);

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = cleaned.slice(start, end + 1);

  // First try: direct parse
  try {
    return JSON.parse(slice);
  } catch {
    // ignore
  }

  // Second try: repair truncated JSON
  const repaired = repairTruncatedJson(slice);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch (err) {
      console.warn("extractJsonObject repair failed", err);
    }
  }

  console.warn("extractJsonObject: could not parse", slice.slice(0, 300));
  return null;
}

/** Sleep helper for retry backoff */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse retry delay from Gemini 429 error message */
function parseRetryDelay(message: string): number | null {
  const match = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
}

async function runChat(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const systemMsg =
        messages.find((m) => m.role === "system")?.content ?? "";
      const userCombined = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n\n");

      const response = await provider.model.generateContent({
        systemInstruction: systemMsg
          ? { role: "system", parts: [{ text: systemMsg }] }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: userCombined }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      const text = response.response?.text();
      if (!text) console.warn("runChat: empty response");
      else console.log("runChat response:", text.slice(0, 500));
      return text || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const is429 =
        message.includes("429") || message.includes("Too Many Requests");

      if (is429 && attempt < MAX_RETRIES) {
        const delay = parseRetryDelay(message) ?? (attempt + 1) * 5000;
        const waitMs = Math.min(delay, 15_000); // cap at 15s
        console.warn(
          `runChat: 429 rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }

      console.error("runChat error:", message);
      return null;
    }
  }

  return null;
}

// Types
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

// Prompt Analysis
const ANALYZE_PROMPT_SYSTEM = `You are evaluating the quality of a database design prompt.

Evaluate on:
1. Specificity (0-25)
2. Relationship clarity (0-25)
3. Constraints & rules (0-25)
4. Real-world completeness (0-25)

Return ONLY compact JSON (no markdown, no explanation) with this exact structure:
{"specificity":<number 0-25>,"relationshipClarity":<number 0-25>,"constraintsAndRules":<number 0-25>,"realWorldCompleteness":<number 0-25>,"totalScore":<number 0-100>,"suggestions":["<string>","<string>"]}

Keep suggestions concise (max 2 sentences each, max 5 suggestions).`;

export async function analyzePrompt(
  prompt: string,
): Promise<AIPromptAnalysis | null> {
  const content = await runChat(
    [
      { role: "system", content: ANALYZE_PROMPT_SYSTEM },
      { role: "user", content: prompt },
    ],
    0.3,
    1000,
  );
  if (!content) return null;

  const parsed = extractJsonObject(content);
  if (!parsed) {
    console.warn("analyzePrompt: no JSON in response", content.slice(0, 400));
    return null;
  }

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

// Prompt Refinement
const REFINE_PROMPT_SYSTEM = `You are an expert database architect helping users improve their database design prompts.

Given the user's original prompt, rewrite it to be:
- Clearer and more specific about entities
- Explicit about relationships between entities
- Include missing constraints, business rules, and validation
- Mention scale, user roles, and timestamps where relevant
- Use professional database terminology

Return ONLY compact JSON (no markdown, no explanation) with this exact structure:
{"improved":"<the improved prompt text>","changes":["<change 1>","<change 2>"]}`;

export async function refinePrompt(
  prompt: string,
): Promise<AIPromptRefinement | null> {
  const content = await runChat(
    [
      { role: "system", content: REFINE_PROMPT_SYSTEM },
      { role: "user", content: prompt },
    ],
    0.5,
    1500,
  );
  if (!content) return null;

  const parsed = extractJsonObject(content);
  if (!parsed) {
    console.warn("refinePrompt: no JSON in response", content.slice(0, 400));
    return null;
  }

  return {
    improved: parsed.improved ?? prompt,
    changes: parsed.changes ?? [],
  };
}

// Schema Review
const REVIEW_SCHEMA_SYSTEM = `You are an expert database architect reviewing a schema design.

Analyze the provided schema JSON and suggest improvements.
Focus on:
1. Design flaws (normalization issues, missing entities)
2. Better naming conventions
3. Missing constraints or indexes
4. Relationship improvements
5. Performance concerns

Return ONLY compact JSON (no markdown, no explanation) with this exact structure:
{"overallAssessment":"<1-2 sentence summary>","issues":[{"severity":"error","title":"<short title>","description":"<detailed description>","suggestion":"<actionable fix>"}]}

Severity must be one of: error, warning, info. Keep to max 8 issues.`;

export async function reviewSchema(
  schema: unknown,
): Promise<AISchemaReview | null> {
  const schemaStr =
    typeof schema === "string" ? schema : JSON.stringify(schema, null, 2);

  const content = await runChat(
    [
      { role: "system", content: REVIEW_SCHEMA_SYSTEM },
      {
        role: "user",
        content: `Review this database schema:\n\n${schemaStr}`,
      },
    ],
    0.3,
    2000,
  );
  if (!content) return null;

  const parsed = extractJsonObject(content);
  if (!parsed) {
    console.warn("reviewSchema: no JSON in response", content.slice(0, 400));
    return null;
  }

  return {
    overallAssessment: parsed.overallAssessment ?? "",
    issues: parsed.issues ?? [],
  };
}

// Schema Generation
const GENERATE_SCHEMA_SYSTEM = `You are an expert database architect. Given a description, generate a PostgreSQL database schema.

Rules:
- Use ONLY these column types: INT, BIGINT, SERIAL, TEXT, VARCHAR, BOOLEAN, DATE, TIMESTAMP, FLOAT, DECIMAL, JSON, UUID. Never add precision like VARCHAR(100) — just use VARCHAR.
- Return ONLY compact JSON with no markdown, no explanation, no extra whitespace.
- Omit defaultValue if not needed.

Exact JSON structure:
{"tables":[{"name":"table_name","columns":[{"name":"col","type":"VARCHAR","isPrimaryKey":false,"isForeignKey":false,"isNullable":false,"isUnique":false}]}],"relationships":[{"sourceTable":"t1","sourceColumn":"c1","targetTable":"t2","targetColumn":"c2","type":"one-to-many","onDelete":"CASCADE"}]}`;

export async function generateSchema(
  prompt: string,
): Promise<AISchemaGeneration | null> {
  const content = await runChat(
    [
      { role: "system", content: GENERATE_SCHEMA_SYSTEM },
      { role: "user", content: prompt },
    ],
    0.4,
    8192,
  );
  if (!content) return null;

  const parsed = extractJsonObject(content);
  if (!parsed) {
    console.warn("generateSchema: no JSON in response", content.slice(0, 400));
    return null;
  }

  return {
    tables: parsed.tables ?? [],
    relationships: parsed.relationships ?? [],
  };
}
