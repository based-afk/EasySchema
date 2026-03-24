// ─── JSON Validator & Repair Utilities ──────────────────────────────────────

/** Strip markdown code fences (```json ... ```) and trim whitespace. */
export function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/gi, "")
    .replace(/```\s*$/g, "")
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * Attempt to repair truncated JSON by closing open brackets/braces.
 * Returns the repaired string, or null if the JSON wasn't truncated.
 */
export function repairTruncatedJson(text: string): string | null {
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

  if (stack.length === 0) return null; // not truncated

  let repaired = text.replace(/,\s*$/, "");
  if (inString) repaired += '"';
  repaired = repaired.replace(/,?\s*"[^"]*"\s*:\s*"?[^"{}[\]]*$/, "");
  repaired = repaired.replace(/,\s*$/, "");

  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === "{" ? "}" : "]";
  }

  return repaired;
}

/**
 * Extract and parse the first JSON object / array from arbitrary text.
 * Handles leading/trailing prose, code fences, and mild truncation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractJsonObject(content: string): any | null {
  if (!content) return null;

  const cleaned = stripMarkdownFences(content);

  // Try full string first
  try {
    return JSON.parse(cleaned);
  } catch {
    /* continue */
  }

  // Extract first { ... }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      /* continue */
    }

    const repaired = repairTruncatedJson(slice);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        /* continue */
      }
    }
  }

  // Try first [ ... ]
  const aStart = cleaned.indexOf("[");
  const aEnd = cleaned.lastIndexOf("]");
  if (aStart !== -1 && aEnd > aStart) {
    const slice = cleaned.slice(aStart, aEnd + 1);
    try {
      return JSON.parse(slice);
    } catch {
      /* continue */
    }
  }

  console.warn(
    "[jsonValidator] Could not extract JSON from:",
    content.slice(0, 200),
  );
  return null;
}

/**
 * Validate and parse a JSON string. Returns null if invalid.
 */
export function validateJsonResponse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Assert that a value is a non-null object with the given keys.
 */
export function hasKeys(
  obj: unknown,
  keys: string[],
): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  return keys.every((k) => k in (obj as Record<string, unknown>));
}
