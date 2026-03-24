// ─── Entity Expansion ────────────────────────────────────────────────────────
//
// Given a raw prompt, detects primary entities and expands them into
// related sub-entities that are typically needed alongside them.
// ─────────────────────────────────────────────────────────────────────────────

type ExpansionMap = Record<string, string[]>;

const EXPANSION_RULES: ExpansionMap = {
  // Commerce
  orders: ["order_items", "payments"],
  products: ["inventory", "product_reviews", "product_images", "categories"],
  users: ["user_profiles", "user_addresses"],
  payments: ["payment_methods", "invoices"],
  cart: ["cart_items"],

  // Content
  posts: ["post_revisions", "post_tags", "post_categories"],
  articles: ["article_tags", "article_categories"],
  comments: ["comment_votes"],

  // SaaS
  organizations: ["teams", "invitations", "api_keys"],
  subscriptions: ["invoices", "usage_records"],
  projects: ["project_members", "tasks", "milestones"],
  tasks: ["task_assignments", "task_comments", "attachments"],

  // Social
  profiles: ["profile_settings", "social_links"],
  follows: [],
  likes: [],
  messages: ["message_attachments", "message_reads"],

  // Education
  courses: ["course_modules", "enrollments", "course_reviews"],
  lessons: ["lesson_progress", "lesson_attachments"],
  students: ["enrollments", "grades"],
  teachers: ["teacher_profiles"],

  // Healthcare
  patients: ["medical_records", "appointments"],
  doctors: ["doctor_schedules", "specializations"],
  appointments: ["appointment_notes"],

  // Hospitality
  reservations: ["reservation_guests"],
  rooms: ["room_amenities", "room_availability"],
  hotels: ["hotel_amenities", "hotel_rooms"],

  // Restaurant
  menus: ["menu_items"],
  recipes: ["recipe_ingredients", "recipe_steps"],
  employees: ["employee_shifts", "employee_roles"],

  // Logistics
  shipments: ["shipment_tracking", "shipment_items"],
  warehouses: ["warehouse_zones", "stock_transfers"],
  suppliers: ["supplier_products", "purchase_orders"],
};

// ─── Entity keywords to detect from prompt ────────────────────────────────────

const ENTITY_TRIGGERS: Record<string, string> = {
  order: "orders",
  orders: "orders",
  product: "products",
  products: "products",
  user: "users",
  users: "users",
  payment: "payments",
  payments: "payments",
  cart: "cart",
  post: "posts",
  posts: "posts",
  article: "articles",
  articles: "articles",
  comment: "comments",
  comments: "comments",
  organization: "organizations",
  organizations: "organizations",
  subscription: "subscriptions",
  subscriptions: "subscriptions",
  project: "projects",
  projects: "projects",
  task: "tasks",
  tasks: "tasks",
  profile: "profiles",
  message: "messages",
  messages: "messages",
  course: "courses",
  courses: "courses",
  lesson: "lessons",
  lessons: "lessons",
  student: "students",
  students: "students",
  teacher: "teachers",
  teachers: "teachers",
  patient: "patients",
  patients: "patients",
  doctor: "doctors",
  doctors: "doctors",
  appointment: "appointments",
  appointments: "appointments",
  reservation: "reservations",
  reservations: "reservations",
  room: "rooms",
  rooms: "rooms",
  hotel: "hotels",
  hotels: "hotels",
  menu: "menus",
  menus: "menus",
  recipe: "recipes",
  recipes: "recipes",
  employee: "employees",
  employees: "employees",
  shipment: "shipments",
  shipments: "shipments",
  warehouse: "warehouses",
  warehouses: "warehouses",
  supplier: "suppliers",
  suppliers: "suppliers",
};

/**
 * Detect primary entities in the prompt and return their expanded sub-entities.
 * Returns a deduplicated list of sub-entity names to add to the schema.
 */
export function expandEntities(prompt: string): string[] {
  const lower = prompt.toLowerCase().replace(/[^\w\s]/g, " ");
  const tokens = lower.split(/\s+/);

  const detectedEntities = new Set<string>();
  for (const token of tokens) {
    const entity = ENTITY_TRIGGERS[token];
    if (entity) detectedEntities.add(entity);
  }

  const expanded = new Set<string>();
  for (const entity of detectedEntities) {
    const expansions = EXPANSION_RULES[entity] ?? [];
    for (const sub of expansions) {
      // Only add if not already in the detected primary entities
      if (!detectedEntities.has(sub)) {
        expanded.add(sub);
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Get the full expansion map for a specific entity.
 */
export function getEntityExpansion(entity: string): string[] {
  return EXPANSION_RULES[entity.toLowerCase()] ?? [];
}
