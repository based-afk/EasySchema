// ─── Rule Engine — Hybrid Prompt Scoring ─────────────────────────────────────
//
// Evaluates a raw prompt and returns a score (0-100) plus detailed breakdown.
// Use this BEFORE making AI calls to decide whether the prompt is worth sending.
// ─────────────────────────────────────────────────────────────────────────────

export interface RuleScore {
  score: number;
  breakdown: RuleScoreBreakdown;
  suggestions: string[];
}

export interface RuleScoreBreakdown {
  lengthScore: number; // 0-20
  entityScore: number; // 0-30
  relationshipScore: number; // 0-20
  specificityScore: number; // 0-15
  constraintScore: number; // 0-15
}

// ─── Keywords ────────────────────────────────────────────────────────────────

const ENTITY_KEYWORDS = new Set([
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
  "event",
  "events",
  "booking",
  "bookings",
  "appointment",
  "appointments",
  "ticket",
  "tickets",
  "employee",
  "employees",
  "department",
  "departments",
  "patient",
  "patients",
  "doctor",
  "doctors",
  "hotel",
  "room",
  "rooms",
  "reservation",
  "reservations",
  "menu",
  "menus",
  "recipe",
  "recipes",
]);

const RELATIONSHIP_KEYWORDS = [
  "belongs to",
  "has many",
  "has one",
  "many-to-many",
  "one-to-many",
  "relates to",
  "linked to",
  "references",
  "foreign key",
  "join",
  "associated with",
  "owns",
  "contains",
  "includes",
  "per",
];

const CONSTRAINT_KEYWORDS = [
  "unique",
  "required",
  "optional",
  "nullable",
  "not null",
  "primary key",
  "index",
  "cascade",
  "restrict",
  "default",
  "limit",
  "max",
  "min",
];

const SPECIFICITY_KEYWORDS = [
  "ecommerce",
  "e-commerce",
  "blog",
  "cms",
  "saas",
  "restaurant",
  "inventory",
  "social",
  "network",
  "crm",
  "erp",
  "lms",
  "hospital",
  "clinic",
  "hotel",
  "marketplace",
  "finance",
  "banking",
  "booking",
  "ticketing",
  "hr",
  "payroll",
  "analytics",
  "dashboard",
];

// ─── Scoring functions ────────────────────────────────────────────────────────

function scoreLengthAndDetail(prompt: string): {
  score: number;
  suggestions: string[];
} {
  const words = prompt.trim().split(/\s+/).length;
  const suggestions: string[] = [];

  if (words < 5) {
    suggestions.push(
      "Your prompt is very short. Describe what your application does.",
    );
    return { score: 2, suggestions };
  }
  if (words < 15) {
    suggestions.push(
      "Add more detail — describe the main entities your system manages.",
    );
    return { score: 8, suggestions };
  }
  if (words < 30) {
    suggestions.push(
      "Good start. Try mentioning how things relate to each other.",
    );
    return { score: 14, suggestions };
  }
  if (words < 60) return { score: 18, suggestions };
  return { score: 20, suggestions };
}

function scoreEntities(prompt: string): { score: number; count: number } {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\W+/);
  const found = words.filter((w) => ENTITY_KEYWORDS.has(w));
  const unique = new Set(found).size;
  const score = Math.min(30, unique * 6);
  return { score, count: unique };
}

function scoreRelationships(prompt: string): { score: number } {
  const lower = prompt.toLowerCase();
  const hits = RELATIONSHIP_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return { score: Math.min(20, hits * 5) };
}

function scoreSpecificity(prompt: string): { score: number } {
  const lower = prompt.toLowerCase();
  const hits = SPECIFICITY_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return { score: Math.min(15, hits * 5) };
}

function scoreConstraints(prompt: string): { score: number } {
  const lower = prompt.toLowerCase();
  const hits = CONSTRAINT_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return { score: Math.min(15, hits * 3) };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function scorePrompt(prompt: string): RuleScore {
  const suggestions: string[] = [];

  const length = scoreLengthAndDetail(prompt);
  const entity = scoreEntities(prompt);
  const relationship = scoreRelationships(prompt);
  const specificity = scoreSpecificity(prompt);
  const constraint = scoreConstraints(prompt);

  suggestions.push(...length.suggestions);

  if (entity.count === 0) {
    suggestions.push(
      "Mention specific entities like 'users', 'products', or 'orders'.",
    );
  }
  if (relationship.score === 0) {
    suggestions.push(
      "Describe how entities relate (e.g., 'users have many orders').",
    );
  }
  if (specificity.score === 0 && entity.count < 2) {
    suggestions.push(
      "Mention the type of application (e.g., 'e-commerce', 'blog', 'SaaS').",
    );
  }

  const breakdown: RuleScoreBreakdown = {
    lengthScore: length.score,
    entityScore: entity.score,
    relationshipScore: relationship.score,
    specificityScore: specificity.score,
    constraintScore: constraint.score,
  };

  const total = Math.min(
    100,
    breakdown.lengthScore +
      breakdown.entityScore +
      breakdown.relationshipScore +
      breakdown.specificityScore +
      breakdown.constraintScore,
  );

  return { score: total, breakdown, suggestions };
}
