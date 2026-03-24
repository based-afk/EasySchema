// ─── Entity Extractor — Extract requested entities from user prompt ──────────
//
// Parses user prompts to identify all requested database entities/tables.
// Handles various phrasing patterns: "users table", "customers", "Product items", etc.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedEntity {
  name: string; // Normalized singular form
  variants: string[]; // Original mentions from prompt
  confidence: number; // 0-1 confidence that this is a real entity
  frequency: number; // How many times mentioned
}

// Keywords that should NOT be treated as entities
const EXCLUDED_KEYWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "be",
  "been",
  "being",
  "have",
  "has",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "could",
  "can",
  "may",
  "might",
  "must",
  "shall",
  "for",
  "from",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "without",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "among",
  "around",
  "about",
  "off",
  "of",
  "and",
  "or",
  "but",
  "not",
  "no",
  "yes",
  "if",
  "unless",
  "because",
  "as",
  "while",
  "when",
  "where",
  "why",
  "how",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "that",
  "this",
  "these",
  "those",
  "such",
  "same",
  "system",
  "application",
  "database",
  "schema",
  "table",
  "column",
  "data",
  "information",
  "details",
  "record",
  "entry",
  "item",
  "thing",
  "one",
  "two",
  "three",
  "four",
  "five",
  "etc",
  "and",
  "or",
]);

// High-confidence entity keywords (strongly suggest database tables)
const HIGH_CONFIDENCE_KEYWORDS = new Set([
  "user",
  "customer",
  "product",
  "order",
  "payment",
  "invoice",
  "transaction",
  "booking",
  "reservation",
  "appointment",
  "employee",
  "department",
  "project",
  "task",
  "ticket",
  "category",
  "tag",
  "post",
  "comment",
  "review",
  "rating",
  "message",
  "notification",
  "log",
  "session",
  "subscription",
  "role",
  "permission",
  "address",
  "location",
  "inventory",
  "warehouse",
  "supplier",
  "vendor",
  "rule",
  "policy",
  "customization",
  "option",
  "variant",
  "ingredient",
  "recipe",
  "menu",
  "coffee",
  "tea",
  "beverage",
  "snack",
  "pastry",
  "student",
  "course",
  "lesson",
  "assignment",
  "grade",
  "transfer",
  "refund",
]);

const PLURAL_MAP: { [key: string]: string } = {
  users: "user",
  customers: "customer",
  products: "product",
  orders: "order",
  payments: "payment",
  invoices: "invoice",
  transactions: "transaction",
  bookings: "booking",
  reservations: "reservation",
  appointments: "appointment",
  employees: "employee",
  departments: "department",
  projects: "project",
  tasks: "task",
  tickets: "ticket",
  categories: "category",
  tags: "tag",
  posts: "post",
  comments: "comment",
  reviews: "review",
  ratings: "rating",
  messages: "message",
  notifications: "notification",
  logs: "log",
  sessions: "session",
  subscriptions: "subscription",
  roles: "role",
  permissions: "permission",
  addresses: "address",
  locations: "location",
  inventories: "inventory",
  warehouses: "warehouse",
  suppliers: "supplier",
  vendors: "vendor",
  rules: "rule",
  policies: "policy",
  customizations: "customization",
  options: "option",
  variants: "variant",
  ingredients: "ingredient",
  recipes: "recipe",
  menus: "menu",
  teas: "tea",
  beverages: "beverage",
  snacks: "snack",
  pastries: "pastry",
  students: "student",
  courses: "course",
  lessons: "lesson",
  assignments: "assignment",
  grades: "grade",
  transfers: "transfer",
  refunds: "refund",
  entries: "entry",
  records: "record",
  shops: "shop",
  stores: "store",
  coffees: "coffee",
};

/**
 * Extract all entities/tables mentioned in a user's prompt
 */
export function extractEntities(prompt: string): ExtractedEntity[] {
  const entities = new Map<string, ExtractedEntity>();

  // Tokenize prompt
  const tokens = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  // Track multi-word patterns like "order items" or "product customizations"
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];

    // Skip excluded words
    if (EXCLUDED_KEYWORDS.has(word)) continue;

    // Check if it's a known entity keyword
    if (HIGH_CONFIDENCE_KEYWORDS.has(word)) {
      const singular = PLURAL_MAP[word] || word;
      addOrUpdateEntity(entities, singular, word, 0.95);
      continue;
    }

    // Try two-word combinations for compound entities
    if (i < tokens.length - 1) {
      const twoWord = `${word} ${tokens[i + 1]}`;
      if (!EXCLUDED_KEYWORDS.has(tokens[i + 1])) {
        // Check if either word is high-confidence
        if (
          HIGH_CONFIDENCE_KEYWORDS.has(word) ||
          HIGH_CONFIDENCE_KEYWORDS.has(tokens[i + 1])
        ) {
          const singular = singularize(twoWord);
          addOrUpdateEntity(entities, singular, twoWord, 0.85);
        }
      }
    }

    // Check if it's a potential entity even if not in keyword list
    // (e.g., domain-specific words like "barista", "roaster", "blend")
    if (word.length > 3 && !isLikelyAdjective(word)) {
      // Calculate confidence based on context
      const confidence = calculateEntityConfidence(word, tokens, i);
      if (confidence > 0.6) {
        addOrUpdateEntity(entities, singularize(word), word, confidence);
      }
    }
  }

  // Also check for explicit "Table: X" or "Entity: X" patterns
  const tablePattern = /(?:table|entity|model|collection):\s*(\w+)/gi;
  let match;
  while ((match = tablePattern.exec(prompt)) !== null) {
    const tableName = match[1].toLowerCase();
    addOrUpdateEntity(entities, singularize(tableName), tableName, 0.99);
  }

  // Also check for "X table" or "X entity" patterns
  const explicitPattern = /(\w+)\s+(?:table|entity|model|collection)\b/gi;
  const seen = new Set<string>();
  while ((match = explicitPattern.exec(prompt)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!seen.has(tableName)) {
      addOrUpdateEntity(entities, singularize(tableName), tableName, 0.98);
      seen.add(tableName);
    }
  }

  // Convert to array and sort by confidence
  const result = Array.from(entities.values()).sort(
    (a, b) => b.confidence - a.confidence,
  );

  return result;
}

/**
 * Normalize plural form to singular
 */
function singularize(word: string): string {
  if (PLURAL_MAP[word]) {
    return PLURAL_MAP[word];
  }

  // Simple heuristics
  if (word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("es")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s")) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Check if a word is likely an adjective (not an entity)
 */
function isLikelyAdjective(word: string): boolean {
  const adjectives = new Set([
    "large",
    "small",
    "big",
    "unique",
    "unique",
    "special",
    "required",
    "optional",
    "primary",
    "secondary",
    "main",
    "new",
    "old",
    "active",
    "inactive",
    "available",
    "unavailable",
    "complete",
    "incomplete",
    "valid",
    "invalid",
  ]);
  return adjectives.has(word);
}

/**
 * Calculate confidence that a word is a database entity
 */
function calculateEntityConfidence(
  word: string,
  tokens: string[],
  index: number,
): number {
  let confidence = 0.5;

  // Capitalized words are more likely entities
  if (word !== word.toLowerCase()) {
    confidence += 0.15;
  }

  // Words near high-confidence keywords are likely entities too
  const neighbors = [tokens[index - 1] || "", tokens[index + 1] || ""];
  if (neighbors.some((n) => HIGH_CONFIDENCE_KEYWORDS.has(n))) {
    confidence += 0.2;
  }

  // Words that end in "-tion", "-ment", "-ance" are often entities
  if (
    word.endsWith("tion") ||
    word.endsWith("ment") ||
    word.endsWith("ance") ||
    word.endsWith("ence")
  ) {
    confidence += 0.1;
  }

  return Math.min(confidence, 0.9);
}

/**
 * Helper: add or update an entity in the map
 */
function addOrUpdateEntity(
  entities: Map<string, ExtractedEntity>,
  singular: string,
  variant: string,
  confidence: number,
): void {
  const existing = entities.get(singular);

  if (existing) {
    existing.variants.push(variant);
    existing.frequency++;
    existing.confidence = Math.max(existing.confidence, confidence);
  } else {
    entities.set(singular, {
      name: singular,
      variants: [variant],
      confidence,
      frequency: 1,
    });
  }
}

/**
 * Extract required entities from prompt (higher threshold)
 */
export function extractRequiredEntities(prompt: string): string[] {
  return extractEntities(prompt)
    .filter((e) => e.confidence >= 0.75)
    .map((e) => e.name);
}

/**
 * Generate a user-friendly summary of extracted entities
 */
export function summarizeExtractedEntities(
  entities: ExtractedEntity[],
): string {
  if (entities.length === 0) {
    return "No database entities detected.";
  }

  const names = entities.slice(0, 10).map((e) => e.name);
  const remaining = Math.max(0, entities.length - 10);

  let summary = `Detected entities: ${names.join(", ")}`;
  if (remaining > 0) {
    summary += ` (+ ${remaining} more)`;
  }

  return summary;
}
