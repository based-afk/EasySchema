// ─── Domain Blueprints (L3 Pre-baked Cache) ─────────────────────────────────
//
// Pre-built AI-quality schema responses for common prompts.
// These are returned INSTANTLY with zero API calls or Redis lookups.
// Each blueprint matches the exact shape of a "generate" mode response.
//
// To add a new blueprint:
// 1. Add trigger phrases to the BLUEPRINTS array
// 2. Add the schema response matching the `runUnified("generate", ...)` shape
// ─────────────────────────────────────────────────────────────────────────────

export interface BlueprintColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
}

export interface BlueprintTable {
  name: string;
  columns: BlueprintColumn[];
}

export interface BlueprintRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface BlueprintSchema {
  mode: "generate";
  tables: BlueprintTable[];
  relationships: BlueprintRelationship[];
}

interface Blueprint {
  /** Trigger phrases — if the normalized prompt contains ALL phrases from any inner array, this blueprint matches */
  triggers: string[][];
  schema: BlueprintSchema;
}

// ─── Helper to create standard columns ──────────────────────────────────────

const pk = (name = "id"): BlueprintColumn => ({
  name,
  type: "SERIAL",
  isPrimaryKey: true,
  isForeignKey: false,
  isNullable: false,
  isUnique: true,
});

const fk = (refTable: string): BlueprintColumn => ({
  name: `${refTable}_id`,
  type: "INT",
  isPrimaryKey: false,
  isForeignKey: true,
  isNullable: false,
  isUnique: false,
});

const varchar = (
  name: string,
  opts: { nullable?: boolean; unique?: boolean; defaultValue?: string } = {},
): BlueprintColumn => ({
  name,
  type: "VARCHAR",
  isPrimaryKey: false,
  isForeignKey: false,
  isNullable: opts.nullable ?? false,
  isUnique: opts.unique ?? false,
  defaultValue: opts.defaultValue,
});

const text = (name: string, nullable = true): BlueprintColumn => ({
  name,
  type: "TEXT",
  isPrimaryKey: false,
  isForeignKey: false,
  isNullable: nullable,
  isUnique: false,
});

const int = (
  name: string,
  opts: { nullable?: boolean; defaultValue?: string } = {},
): BlueprintColumn => ({
  name,
  type: "INT",
  isPrimaryKey: false,
  isForeignKey: false,
  isNullable: opts.nullable ?? false,
  isUnique: false,
  defaultValue: opts.defaultValue,
});

const decimal = (name: string): BlueprintColumn => ({
  name,
  type: "DECIMAL",
  isPrimaryKey: false,
  isForeignKey: false,
  isNullable: false,
  isUnique: false,
});

const bool = (
  name: string,
  defaultValue = "false",
): BlueprintColumn => ({
  name,
  type: "BOOLEAN",
  isPrimaryKey: false,
  isForeignKey: false,
  isNullable: false,
  isUnique: false,
  defaultValue,
});

const timestamp = (
  name: string,
  opts: { nullable?: boolean; defaultValue?: string } = {},
): BlueprintColumn => ({
  name,
  type: "TIMESTAMP",
  isPrimaryKey: false,
  isForeignKey: false,
  isNullable: opts.nullable ?? false,
  isUnique: false,
  defaultValue: opts.defaultValue,
});

const timestamps = (): BlueprintColumn[] => [
  timestamp("created_at", { defaultValue: "NOW()" }),
  timestamp("updated_at", { nullable: true }),
];

// ─── Blueprints ─────────────────────────────────────────────────────────────

const BLUEPRINTS: Blueprint[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. E-COMMERCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    triggers: [
      ["e-commerce"],
      ["ecommerce"],
      ["online store"],
      ["online shop"],
      ["shopping", "cart"],
      ["product", "order", "user"],
      ["product", "order", "customer"],
    ],
    schema: {
      mode: "generate",
      tables: [
        {
          name: "users",
          columns: [pk(), varchar("name"), varchar("email", { unique: true }), varchar("password_hash"), varchar("phone", { nullable: true }), varchar("role", { defaultValue: "'customer'" }), ...timestamps()],
        },
        {
          name: "addresses",
          columns: [pk(), fk("user"), varchar("street"), varchar("city"), varchar("state", { nullable: true }), varchar("zip_code"), varchar("country"), bool("is_default", "false"), ...timestamps()],
        },
        {
          name: "categories",
          columns: [pk(), varchar("name", { unique: true }), text("description"), varchar("slug", { unique: true }), int("parent_category_id", { nullable: true }), ...timestamps()],
        },
        {
          name: "products",
          columns: [pk(), varchar("name"), text("description"), decimal("price"), decimal("compare_at_price"), int("stock_quantity", { defaultValue: "0" }), varchar("sku", { unique: true }), varchar("slug", { unique: true }), bool("is_active", "true"), fk("category"), ...timestamps()],
        },
        {
          name: "product_images",
          columns: [pk(), fk("product"), varchar("url"), varchar("alt_text", { nullable: true }), int("sort_order", { defaultValue: "0" }), bool("is_primary", "false")],
        },
        {
          name: "orders",
          columns: [pk(), fk("user"), varchar("order_number", { unique: true }), varchar("status", { defaultValue: "'pending'" }), decimal("subtotal"), decimal("tax"), decimal("shipping_cost"), decimal("total"), text("notes", true), fk("shipping_address" as never), ...timestamps()],
        },
        {
          name: "order_items",
          columns: [pk(), fk("order"), fk("product"), int("quantity", { defaultValue: "1" }), decimal("unit_price"), decimal("total_price")],
        },
        {
          name: "payments",
          columns: [pk(), fk("order"), decimal("amount"), varchar("method"), varchar("status", { defaultValue: "'pending'" }), varchar("transaction_id", { nullable: true, unique: true }), ...timestamps()],
        },
        {
          name: "reviews",
          columns: [pk(), fk("user"), fk("product"), int("rating"), text("comment", true), bool("is_verified", "false"), ...timestamps()],
        },
        {
          name: "carts",
          columns: [pk(), fk("user"), ...timestamps()],
        },
        {
          name: "cart_items",
          columns: [pk(), fk("cart"), fk("product"), int("quantity", { defaultValue: "1" })],
        },
        {
          name: "coupons",
          columns: [pk(), varchar("code", { unique: true }), varchar("discount_type"), decimal("discount_value"), decimal("min_order_amount"), int("max_uses", { nullable: true }), int("times_used", { defaultValue: "0" }), timestamp("expires_at", { nullable: true }), bool("is_active", "true"), ...timestamps()],
        },
      ],
      relationships: [
        { sourceTable: "addresses", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "products", sourceColumn: "category_id", targetTable: "categories", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "product_images", sourceColumn: "product_id", targetTable: "products", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "orders", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "RESTRICT" },
        { sourceTable: "order_items", sourceColumn: "order_id", targetTable: "orders", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "order_items", sourceColumn: "product_id", targetTable: "products", targetColumn: "id", type: "one-to-many", onDelete: "RESTRICT" },
        { sourceTable: "payments", sourceColumn: "order_id", targetTable: "orders", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "reviews", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "reviews", sourceColumn: "product_id", targetTable: "products", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "carts", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-one", onDelete: "CASCADE" },
        { sourceTable: "cart_items", sourceColumn: "cart_id", targetTable: "carts", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "cart_items", sourceColumn: "product_id", targetTable: "products", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. BLOG / CMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    triggers: [
      ["blog"],
      ["cms"],
      ["content management"],
      ["post", "comment", "user"],
      ["article", "comment"],
    ],
    schema: {
      mode: "generate",
      tables: [
        {
          name: "users",
          columns: [pk(), varchar("username", { unique: true }), varchar("email", { unique: true }), varchar("password_hash"), varchar("display_name"), text("bio", true), varchar("avatar_url", { nullable: true }), varchar("role", { defaultValue: "'author'" }), ...timestamps()],
        },
        {
          name: "categories",
          columns: [pk(), varchar("name", { unique: true }), varchar("slug", { unique: true }), text("description", true), int("parent_id", { nullable: true }), ...timestamps()],
        },
        {
          name: "posts",
          columns: [pk(), varchar("title"), varchar("slug", { unique: true }), text("content"), text("excerpt", true), varchar("status", { defaultValue: "'draft'" }), varchar("featured_image", { nullable: true }), fk("author" as never), fk("category"), timestamp("published_at", { nullable: true }), ...timestamps()],
        },
        {
          name: "tags",
          columns: [pk(), varchar("name", { unique: true }), varchar("slug", { unique: true })],
        },
        {
          name: "post_tags",
          columns: [pk(), fk("post"), fk("tag")],
        },
        {
          name: "comments",
          columns: [pk(), text("body"), fk("post"), fk("user"), int("parent_comment_id", { nullable: true }), bool("is_approved", "true"), ...timestamps()],
        },
        {
          name: "media",
          columns: [pk(), varchar("filename"), varchar("url"), varchar("mime_type"), int("size_bytes"), fk("user"), ...timestamps()],
        },
      ],
      relationships: [
        { sourceTable: "posts", sourceColumn: "author_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "posts", sourceColumn: "category_id", targetTable: "categories", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "post_tags", sourceColumn: "post_id", targetTable: "posts", targetColumn: "id", type: "many-to-many", onDelete: "CASCADE" },
        { sourceTable: "post_tags", sourceColumn: "tag_id", targetTable: "tags", targetColumn: "id", type: "many-to-many", onDelete: "CASCADE" },
        { sourceTable: "comments", sourceColumn: "post_id", targetTable: "posts", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "comments", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "media", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SaaS / PROJECT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    triggers: [
      ["project management"],
      ["saas"],
      ["team", "project", "task"],
      ["task management"],
      ["project", "task", "user"],
    ],
    schema: {
      mode: "generate",
      tables: [
        {
          name: "users",
          columns: [pk(), varchar("name"), varchar("email", { unique: true }), varchar("password_hash"), varchar("avatar_url", { nullable: true }), ...timestamps()],
        },
        {
          name: "organizations",
          columns: [pk(), varchar("name"), varchar("slug", { unique: true }), varchar("plan", { defaultValue: "'free'" }), ...timestamps()],
        },
        {
          name: "org_members",
          columns: [pk(), fk("organization"), fk("user"), varchar("role", { defaultValue: "'member'" }), timestamp("joined_at", { defaultValue: "NOW()" })],
        },
        {
          name: "projects",
          columns: [pk(), varchar("name"), text("description", true), varchar("status", { defaultValue: "'active'" }), fk("organization"), fk("owner" as never), ...timestamps()],
        },
        {
          name: "tasks",
          columns: [pk(), varchar("title"), text("description", true), varchar("status", { defaultValue: "'todo'" }), varchar("priority", { defaultValue: "'medium'" }), fk("project"), fk("assignee" as never), fk("creator" as never), timestamp("due_date", { nullable: true }), int("estimated_hours", { nullable: true }), int("sort_order", { defaultValue: "0" }), ...timestamps()],
        },
        {
          name: "task_comments",
          columns: [pk(), text("body"), fk("task"), fk("user"), ...timestamps()],
        },
        {
          name: "labels",
          columns: [pk(), varchar("name"), varchar("color", { defaultValue: "'#6366f1'" }), fk("organization")],
        },
        {
          name: "task_labels",
          columns: [pk(), fk("task"), fk("label")],
        },
        {
          name: "files",
          columns: [pk(), varchar("name"), varchar("url"), int("size_bytes"), fk("task"), fk("user"), ...timestamps()],
        },
        {
          name: "activity_log",
          columns: [pk(), varchar("action"), text("details", true), fk("user"), fk("project"), fk("task"), ...timestamps()],
        },
      ],
      relationships: [
        { sourceTable: "org_members", sourceColumn: "organization_id", targetTable: "organizations", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "org_members", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "projects", sourceColumn: "organization_id", targetTable: "organizations", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "tasks", sourceColumn: "project_id", targetTable: "projects", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "task_comments", sourceColumn: "task_id", targetTable: "tasks", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "task_comments", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "task_labels", sourceColumn: "task_id", targetTable: "tasks", targetColumn: "id", type: "many-to-many", onDelete: "CASCADE" },
        { sourceTable: "task_labels", sourceColumn: "label_id", targetTable: "labels", targetColumn: "id", type: "many-to-many", onDelete: "CASCADE" },
        { sourceTable: "files", sourceColumn: "task_id", targetTable: "tasks", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "activity_log", sourceColumn: "project_id", targetTable: "projects", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LMS — LEARNING MANAGEMENT SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    triggers: [
      ["lms"],
      ["learning management"],
      ["online course"],
      ["course", "student", "lesson"],
      ["course", "enrollment"],
      ["student", "teacher", "course"],
    ],
    schema: {
      mode: "generate",
      tables: [
        {
          name: "users",
          columns: [pk(), varchar("name"), varchar("email", { unique: true }), varchar("password_hash"), varchar("role", { defaultValue: "'student'" }), varchar("avatar_url", { nullable: true }), text("bio", true), ...timestamps()],
        },
        {
          name: "courses",
          columns: [pk(), varchar("title"), varchar("slug", { unique: true }), text("description"), varchar("difficulty", { defaultValue: "'beginner'" }), decimal("price"), bool("is_published", "false"), varchar("thumbnail_url", { nullable: true }), fk("instructor" as never), ...timestamps()],
        },
        {
          name: "sections",
          columns: [pk(), varchar("title"), int("sort_order", { defaultValue: "0" }), fk("course"), ...timestamps()],
        },
        {
          name: "lessons",
          columns: [pk(), varchar("title"), text("content", true), varchar("video_url", { nullable: true }), int("duration_minutes", { nullable: true }), int("sort_order", { defaultValue: "0" }), bool("is_free", "false"), fk("section"), ...timestamps()],
        },
        {
          name: "enrollments",
          columns: [pk(), fk("user"), fk("course"), varchar("status", { defaultValue: "'active'" }), int("progress_percent", { defaultValue: "0" }), timestamp("enrolled_at", { defaultValue: "NOW()" }), timestamp("completed_at", { nullable: true })],
        },
        {
          name: "lesson_completions",
          columns: [pk(), fk("user"), fk("lesson"), timestamp("completed_at", { defaultValue: "NOW()" })],
        },
        {
          name: "assignments",
          columns: [pk(), varchar("title"), text("description"), fk("course"), timestamp("due_date", { nullable: true }), int("max_score", { defaultValue: "100" }), ...timestamps()],
        },
        {
          name: "submissions",
          columns: [pk(), fk("assignment"), fk("user"), text("content"), int("score", { nullable: true }), text("feedback", true), varchar("status", { defaultValue: "'submitted'" }), ...timestamps()],
        },
        {
          name: "reviews",
          columns: [pk(), fk("user"), fk("course"), int("rating"), text("comment", true), ...timestamps()],
        },
      ],
      relationships: [
        { sourceTable: "courses", sourceColumn: "instructor_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "RESTRICT" },
        { sourceTable: "sections", sourceColumn: "course_id", targetTable: "courses", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "lessons", sourceColumn: "section_id", targetTable: "sections", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "enrollments", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "enrollments", sourceColumn: "course_id", targetTable: "courses", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "lesson_completions", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "lesson_completions", sourceColumn: "lesson_id", targetTable: "lessons", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "assignments", sourceColumn: "course_id", targetTable: "courses", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "submissions", sourceColumn: "assignment_id", targetTable: "assignments", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "submissions", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "reviews", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "reviews", sourceColumn: "course_id", targetTable: "courses", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SOCIAL NETWORK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    triggers: [
      ["social network"],
      ["social media"],
      ["post", "like", "follow"],
      ["post", "friend", "message"],
    ],
    schema: {
      mode: "generate",
      tables: [
        {
          name: "users",
          columns: [pk(), varchar("username", { unique: true }), varchar("email", { unique: true }), varchar("password_hash"), varchar("display_name"), text("bio", true), varchar("avatar_url", { nullable: true }), varchar("cover_url", { nullable: true }), bool("is_verified", "false"), ...timestamps()],
        },
        {
          name: "follows",
          columns: [pk(), fk("follower" as never), fk("following" as never), timestamp("followed_at", { defaultValue: "NOW()" })],
        },
        {
          name: "posts",
          columns: [pk(), text("content"), varchar("media_url", { nullable: true }), varchar("media_type", { nullable: true }), varchar("visibility", { defaultValue: "'public'" }), fk("user"), int("like_count", { defaultValue: "0" }), int("comment_count", { defaultValue: "0" }), ...timestamps()],
        },
        {
          name: "likes",
          columns: [pk(), fk("user"), fk("post"), timestamp("liked_at", { defaultValue: "NOW()" })],
        },
        {
          name: "comments",
          columns: [pk(), text("body"), fk("post"), fk("user"), int("parent_comment_id", { nullable: true }), ...timestamps()],
        },
        {
          name: "messages",
          columns: [pk(), fk("sender" as never), fk("receiver" as never), text("content"), bool("is_read", "false"), ...timestamps()],
        },
        {
          name: "notifications",
          columns: [pk(), fk("user"), varchar("type"), text("content"), bool("is_read", "false"), varchar("reference_type", { nullable: true }), int("reference_id", { nullable: true }), ...timestamps()],
        },
      ],
      relationships: [
        { sourceTable: "follows", sourceColumn: "follower_id", targetTable: "users", targetColumn: "id", type: "many-to-many", onDelete: "CASCADE" },
        { sourceTable: "follows", sourceColumn: "following_id", targetTable: "users", targetColumn: "id", type: "many-to-many", onDelete: "CASCADE" },
        { sourceTable: "posts", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "likes", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "likes", sourceColumn: "post_id", targetTable: "posts", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "comments", sourceColumn: "post_id", targetTable: "posts", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "comments", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "messages", sourceColumn: "sender_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "messages", sourceColumn: "receiver_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "notifications", sourceColumn: "user_id", targetTable: "users", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. HEALTHCARE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    triggers: [
      ["healthcare"],
      ["hospital"],
      ["clinic"],
      ["patient", "doctor", "appointment"],
      ["medical", "record"],
    ],
    schema: {
      mode: "generate",
      tables: [
        {
          name: "patients",
          columns: [pk(), varchar("name"), varchar("email", { unique: true }), varchar("phone", { nullable: true }), varchar("date_of_birth"), varchar("gender", { nullable: true }), varchar("blood_type", { nullable: true }), text("allergies", true), varchar("emergency_contact", { nullable: true }), ...timestamps()],
        },
        {
          name: "doctors",
          columns: [pk(), varchar("name"), varchar("email", { unique: true }), varchar("phone", { nullable: true }), varchar("specialization"), varchar("license_number", { unique: true }), ...timestamps()],
        },
        {
          name: "departments",
          columns: [pk(), varchar("name", { unique: true }), text("description", true), varchar("location", { nullable: true })],
        },
        {
          name: "appointments",
          columns: [pk(), fk("patient"), fk("doctor"), timestamp("scheduled_at"), int("duration_minutes", { defaultValue: "30" }), varchar("status", { defaultValue: "'scheduled'" }), text("notes", true), varchar("type", { defaultValue: "'consultation'" }), ...timestamps()],
        },
        {
          name: "medical_records",
          columns: [pk(), fk("patient"), fk("doctor"), fk("appointment"), text("diagnosis"), text("treatment"), text("notes", true), ...timestamps()],
        },
        {
          name: "prescriptions",
          columns: [pk(), fk("medical_record"), varchar("medication"), varchar("dosage"), varchar("frequency"), int("duration_days"), text("instructions", true), ...timestamps()],
        },
      ],
      relationships: [
        { sourceTable: "appointments", sourceColumn: "patient_id", targetTable: "patients", targetColumn: "id", type: "one-to-many", onDelete: "RESTRICT" },
        { sourceTable: "appointments", sourceColumn: "doctor_id", targetTable: "doctors", targetColumn: "id", type: "one-to-many", onDelete: "RESTRICT" },
        { sourceTable: "medical_records", sourceColumn: "patient_id", targetTable: "patients", targetColumn: "id", type: "one-to-many", onDelete: "RESTRICT" },
        { sourceTable: "medical_records", sourceColumn: "doctor_id", targetTable: "doctors", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "medical_records", sourceColumn: "appointment_id", targetTable: "appointments", targetColumn: "id", type: "one-to-one", onDelete: "SET NULL" },
        { sourceTable: "prescriptions", sourceColumn: "medical_record_id", targetTable: "medical_records", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. RESTAURANT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    triggers: [
      ["restaurant"],
      ["food ordering"],
      ["menu", "order", "table"],
      ["restaurant", "reservation"],
    ],
    schema: {
      mode: "generate",
      tables: [
        {
          name: "staff",
          columns: [pk(), varchar("name"), varchar("email", { unique: true }), varchar("password_hash"), varchar("role", { defaultValue: "'waiter'" }), varchar("phone", { nullable: true }), ...timestamps()],
        },
        {
          name: "menu_categories",
          columns: [pk(), varchar("name", { unique: true }), text("description", true), int("sort_order", { defaultValue: "0" })],
        },
        {
          name: "menu_items",
          columns: [pk(), varchar("name"), text("description", true), decimal("price"), varchar("image_url", { nullable: true }), bool("is_available", "true"), fk("menu_category"), ...timestamps()],
        },
        {
          name: "tables",
          columns: [pk(), varchar("table_number", { unique: true }), int("capacity"), varchar("status", { defaultValue: "'available'" }), varchar("location", { nullable: true })],
        },
        {
          name: "reservations",
          columns: [pk(), varchar("customer_name"), varchar("customer_phone"), varchar("customer_email", { nullable: true }), fk("table"), timestamp("reserved_at"), int("party_size"), varchar("status", { defaultValue: "'confirmed'" }), text("notes", true), ...timestamps()],
        },
        {
          name: "orders",
          columns: [pk(), fk("table"), fk("staff"), varchar("status", { defaultValue: "'open'" }), decimal("subtotal"), decimal("tax"), decimal("tip"), decimal("total"), ...timestamps()],
        },
        {
          name: "order_items",
          columns: [pk(), fk("order"), fk("menu_item"), int("quantity", { defaultValue: "1" }), decimal("unit_price"), text("special_instructions", true)],
        },
      ],
      relationships: [
        { sourceTable: "menu_items", sourceColumn: "menu_category_id", targetTable: "menu_categories", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "reservations", sourceColumn: "table_id", targetTable: "tables", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "orders", sourceColumn: "table_id", targetTable: "tables", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "orders", sourceColumn: "staff_id", targetTable: "staff", targetColumn: "id", type: "one-to-many", onDelete: "SET NULL" },
        { sourceTable: "order_items", sourceColumn: "order_id", targetTable: "orders", targetColumn: "id", type: "one-to-many", onDelete: "CASCADE" },
        { sourceTable: "order_items", sourceColumn: "menu_item_id", targetTable: "menu_items", targetColumn: "id", type: "one-to-many", onDelete: "RESTRICT" },
      ],
    },
  },
];

// ─── Normalization ──────────────────────────────────────────────────────────

const FILLER_WORDS = new Set([
  "a", "an", "the", "for", "with", "and", "or", "of", "to", "in",
  "on", "at", "by", "is", "it", "my", "i", "we", "our", "me",
  "that", "this", "like", "want", "need", "build", "create", "make",
  "design", "database", "schema", "system", "app", "application",
  "backend", "server", "api", "please", "can", "you", "should",
  "would", "could", "be", "have", "has", "do", "does", "just",
  "some", "also", "about", "where", "from",
]);

/**
 * Normalize a prompt for cache key matching:
 * - lowercase
 * - strip filler words
 * - sort remaining words alphabetically
 * - join with single space
 */
export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER_WORDS.has(w))
    .sort()
    .join(" ")
    .trim();
}

// ─── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Check if a prompt matches a pre-baked domain blueprint.
 * Returns the blueprint response (matching `generate` mode shape) or null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function matchBlueprint(prompt: string): any | null {
  const lower = prompt.toLowerCase();

  for (const bp of BLUEPRINTS) {
    const matched = bp.triggers.some((triggerGroup) =>
      triggerGroup.every((phrase) => lower.includes(phrase)),
    );

    if (matched) {
      console.log(`[Blueprint] Matched domain for prompt: "${prompt.slice(0, 60)}..."`);
      // Return a deep copy so callers can mutate without affecting the blueprint
      return JSON.parse(JSON.stringify(bp.schema));
    }
  }

  return null;
}
