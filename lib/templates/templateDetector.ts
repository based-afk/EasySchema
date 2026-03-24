// ─── Template Detector ────────────────────────────────────────────────────────
//
// Detects which domain templates apply to a given prompt.
// Supports multi-template detection (e.g., "ecommerce + social_network").
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateName =
  | "ecommerce"
  | "blog"
  | "saas"
  | "restaurant"
  | "inventory"
  | "social_network";

interface TemplateSignature {
  name: TemplateName;
  /** Any of these phrases triggers the template */
  phrases: string[];
  /** Must NOT contain these to avoid false positives */
  excludePhrases?: string[];
}

const TEMPLATES: TemplateSignature[] = [
  {
    name: "ecommerce",
    phrases: [
      "ecommerce",
      "e-commerce",
      "online store",
      "shop",
      "shopping",
      "products",
      "cart",
      "checkout",
      "orders",
      "payments",
      "marketplace",
      "vendor",
      "buyer",
      "seller",
      "wishlist",
      "catalogue",
      "catalog",
    ],
    excludePhrases: ["restaurant menu"],
  },
  {
    name: "blog",
    phrases: [
      "blog",
      "cms",
      "content management",
      "articles",
      "posts",
      "authors",
      "publishing",
      "newsletter",
      "editorial",
    ],
  },
  {
    name: "saas",
    phrases: [
      "saas",
      "software as a service",
      "subscription",
      "tenants",
      "multi-tenant",
      "billing",
      "plans",
      "tiers",
      "workspace",
      "organizations",
      "teams",
      "api keys",
      "feature flags",
    ],
  },
  {
    name: "restaurant",
    phrases: [
      "restaurant",
      "menu",
      "food ordering",
      "kitchen",
      "waitstaff",
      "reservation",
      "table booking",
      "dining",
      "recipe",
      "ingredients",
      "chef",
      "delivery",
      "takeout",
      "takeaway",
    ],
  },
  {
    name: "inventory",
    phrases: [
      "inventory",
      "warehouse",
      "stock",
      "supply chain",
      "stock level",
      "stock management",
      "storage",
      "sku",
      "barcode",
      "supplier",
      "purchase order",
      "reorder",
      "logistics",
    ],
  },
  {
    name: "social_network",
    phrases: [
      "social network",
      "social media",
      "followers",
      "following",
      "friends",
      "feed",
      "timeline",
      "posts",
      "likes",
      "shares",
      "comments",
      "profiles",
      "connections",
      "newsfeed",
    ],
  },
];

/**
 * Detect which templates apply to the prompt.
 * Returns an array of matched template names (may be >1).
 */
export function detectTemplates(prompt: string): TemplateName[] {
  const lower = prompt.toLowerCase();
  const matches: TemplateName[] = [];

  for (const tmpl of TEMPLATES) {
    const hasExclude =
      tmpl.excludePhrases?.some((ex) => lower.includes(ex)) ?? false;
    if (hasExclude) continue;

    const hasMatch = tmpl.phrases.some((ph) => lower.includes(ph));
    if (hasMatch) matches.push(tmpl.name);
  }

  return matches;
}
