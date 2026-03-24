// ─── Prompt Normalizer ───────────────────────────────────────────────────────
//
// Normalizes raw user prompts into a canonical form for cache-key generation
// and rule-engine matching.
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "with",
  "that",
  "this",
  "and",
  "or",
  "but",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "up",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "i",
  "want",
  "need",
  "build",
  "create",
  "make",
  "design",
  "generate",
  "me",
  "my",
  "our",
  "its",
  "can",
  "should",
  "would",
  "could",
  "will",
  "has",
  "have",
  "had",
  "also",
  "using",
  "system",
  "app",
  "application",
  "platform",
  "website",
  "web",
  "database",
  "db",
  "schema",
  "table",
  "tables",
]);

/**
 * Normalize a prompt for deterministic cache key generation.
 * - Lowercase
 * - Remove punctuation
 * - Remove stop words
 * - Sort remaining tokens alphabetically
 */
export function normalizePrompt(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .sort()
    .join(" ");
}

/**
 * Extract entity tokens from a prompt (nouns that likely map to DB tables).
 */
export function extractEntityTokens(prompt: string): string[] {
  const normalized = prompt.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);

  const ENTITY_HINTS = new Set([
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
    "message",
    "messages",
    "chat",
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
    "event",
    "events",
    "booking",
    "bookings",
    "appointment",
    "appointments",
    "ticket",
    "tickets",
    "report",
    "reports",
    "feedback",
    "rating",
    "ratings",
    "store",
    "stores",
    "shop",
    "shops",
    "restaurant",
    "restaurants",
    "menu",
    "menus",
    "recipe",
    "recipes",
    "ingredient",
    "ingredients",
    "employee",
    "employees",
    "department",
    "departments",
    "clinic",
    "hospital",
    "patient",
    "patients",
    "doctor",
    "doctors",
    "hotel",
    "room",
    "rooms",
    "reservation",
    "reservations",
  ]);

  return words.filter((w) => ENTITY_HINTS.has(w));
}

/**
 * Return a short fingerprint of a prompt for logging (first 60 chars, sanitized).
 */
export function promptFingerprint(prompt: string): string {
  return prompt.slice(0, 60).replace(/\s+/g, " ").trim();
}
