import { TableSchema, ExportFormat, Column, ColumnType } from "./schema-types";

// ─── Clarity Score Calculator ───────────────────────────────────────────────

interface ClarityResult {
  score: number;
  suggestions: string[];
  detectedEntities: string[];
  detectedRelationships: string[];
}

export function calculateClarity(description: string): ClarityResult {
  const suggestions: string[] = [];
  const detectedEntities: string[] = [];
  const detectedRelationships: string[] = [];
  let score = 0;

  if (!description.trim()) {
    return {
      score: 0,
      suggestions: ["Start by describing what your application does."],
      detectedEntities: [],
      detectedRelationships: [],
    };
  }

  // Length check
  const words = description.trim().split(/\s+/).length;
  if (words < 5) {
    suggestions.push(
      "Add more detail — describe the main things your app manages.",
    );
  } else if (words < 15) {
    score += 10;
    suggestions.push(
      "Good start. Try mentioning how things relate to each other.",
    );
  } else if (words < 30) {
    score += 20;
  } else {
    score += 30;
  }

  // Entity detection
  const entityKeywords = [
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
    "submission",
    "submissions",
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
  ];

  const lowerDesc = description.toLowerCase();
  for (const keyword of entityKeywords) {
    if (lowerDesc.includes(keyword) && !detectedEntities.includes(keyword)) {
      detectedEntities.push(keyword);
    }
  }

  if (detectedEntities.length === 0) {
    suggestions.push(
      "Mention the main things your app manages (e.g., users, products, orders).",
    );
  } else if (detectedEntities.length < 3) {
    score += 15;
    suggestions.push("Try adding more entities for a richer schema.");
  } else if (detectedEntities.length < 5) {
    score += 25;
  } else {
    score += 35;
  }

  // Relationship detection
  const relationshipKeywords = [
    "has",
    "have",
    "belongs to",
    "contains",
    "owns",
    "manages",
    "placed by",
    "created by",
    "assigned to",
    "connected to",
    "references",
    "links to",
    "relates to",
    "part of",
    "who",
    "which",
    "with",
    "their",
    "each",
  ];

  for (const keyword of relationshipKeywords) {
    if (lowerDesc.includes(keyword)) {
      detectedRelationships.push(keyword);
    }
  }

  if (detectedRelationships.length === 0) {
    suggestions.push(
      "Describe how things relate (e.g., 'users place orders', 'orders contain products').",
    );
  } else if (detectedRelationships.length < 2) {
    score += 10;
  } else {
    score += 20;
  }

  // Constraints / details detection
  const constraintKeywords = [
    "unique",
    "required",
    "optional",
    "default",
    "not null",
    "index",
    "track",
    "tracking",
  ];
  let hasConstraints = false;
  for (const keyword of constraintKeywords) {
    if (lowerDesc.includes(keyword)) {
      hasConstraints = true;
      break;
    }
  }

  if (hasConstraints) {
    score += 15;
  } else if (score > 40) {
    suggestions.push(
      "Consider mentioning constraints (e.g., 'email must be unique', 'track creation date').",
    );
  }

  // Cap score
  score = Math.min(score, 100);

  if (score >= 70 && suggestions.length === 0) {
    suggestions.push("Looking great! Hit Generate to create your schema.");
  }

  return { score, suggestions, detectedEntities, detectedRelationships };
}

// ─── Schema Generator (local, deterministic) ───────────────────────────────

export function generateSchemaFromDescription(
  description: string,
): TableSchema[] {
  const lowerDesc = description.toLowerCase();
  const tables: TableSchema[] = [];
  let colId = 0;
  const nextId = () => `col-${++colId}`;

  const makeTimestamps = (): Column[] => [
    {
      id: nextId(),
      name: "created_at",
      type: "TIMESTAMP",
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: false,
      isUnique: false,
      defaultValue: "NOW()",
    },
    {
      id: nextId(),
      name: "updated_at",
      type: "TIMESTAMP",
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: true,
      isUnique: false,
    },
  ];

  const makePK = (): Column => ({
    id: nextId(),
    name: "id",
    type: "SERIAL",
    isPrimaryKey: true,
    isForeignKey: false,
    isNullable: false,
    isUnique: true,
  });

  const makeFK = (refTable: string): Column => ({
    id: nextId(),
    name: `${refTable}_id`,
    type: "INT",
    isPrimaryKey: false,
    isForeignKey: true,
    isNullable: false,
    isUnique: false,
    references: { table: refTable, column: "id" },
  });

  // Detect entities and create tables
  const entityMap: Record<
    string,
    { keywords: string[]; columns: () => Column[] }
  > = {
    users: {
      keywords: [
        "user",
        "users",
        "customer",
        "customers",
        "account",
        "accounts",
        "member",
        "members",
      ],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "name",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "email",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: true,
        },
        {
          id: nextId(),
          name: "password_hash",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        ...makeTimestamps(),
      ],
    },
    products: {
      keywords: ["product", "products", "item", "items", "goods"],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "name",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "description",
          type: "TEXT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "price",
          type: "DECIMAL",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "stock",
          type: "INT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "0",
        },
        ...makeTimestamps(),
      ],
    },
    orders: {
      keywords: ["order", "orders", "purchase", "purchases"],
      columns: () => [
        makePK(),
        makeFK("users"),
        {
          id: nextId(),
          name: "total",
          type: "DECIMAL",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "status",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "'pending'",
        },
        ...makeTimestamps(),
      ],
    },
    order_items: {
      keywords: ["order item", "order items", "line item", "line items"],
      columns: () => [
        makePK(),
        makeFK("orders"),
        makeFK("products"),
        {
          id: nextId(),
          name: "quantity",
          type: "INT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "1",
        },
        {
          id: nextId(),
          name: "price",
          type: "DECIMAL",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
      ],
    },
    posts: {
      keywords: ["post", "posts", "article", "articles", "blog"],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "title",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "content",
          type: "TEXT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
        },
        makeFK("users"),
        ...makeTimestamps(),
      ],
    },
    comments: {
      keywords: ["comment", "comments"],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "body",
          type: "TEXT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        makeFK("posts"),
        makeFK("users"),
        ...makeTimestamps(),
      ],
    },
    categories: {
      keywords: ["category", "categories"],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "name",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: true,
        },
        {
          id: nextId(),
          name: "description",
          type: "TEXT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
        },
      ],
    },
    reviews: {
      keywords: ["review", "reviews", "rating", "ratings"],
      columns: () => [
        makePK(),
        makeFK("users"),
        makeFK("products"),
        {
          id: nextId(),
          name: "rating",
          type: "INT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "comment",
          type: "TEXT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
        },
        ...makeTimestamps(),
      ],
    },
    payments: {
      keywords: ["payment", "payments", "transaction", "transactions"],
      columns: () => [
        makePK(),
        makeFK("orders"),
        {
          id: nextId(),
          name: "amount",
          type: "DECIMAL",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "method",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "status",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "'pending'",
        },
        ...makeTimestamps(),
      ],
    },
    tasks: {
      keywords: ["task", "tasks", "todo", "todos"],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "title",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "description",
          type: "TEXT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "status",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "'todo'",
        },
        {
          id: nextId(),
          name: "due_date",
          type: "DATE",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
        },
        makeFK("users"),
        ...makeTimestamps(),
      ],
    },
    projects: {
      keywords: ["project", "projects"],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "name",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: false,
        },
        {
          id: nextId(),
          name: "description",
          type: "TEXT",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          isUnique: false,
        },
        makeFK("users"),
        ...makeTimestamps(),
      ],
    },
    teams: {
      keywords: ["team", "teams", "organization", "company"],
      columns: () => [
        makePK(),
        {
          id: nextId(),
          name: "name",
          type: "VARCHAR",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUnique: true,
        },
        ...makeTimestamps(),
      ],
    },
  };

  const createdTables = new Set<string>();

  for (const [tableName, config] of Object.entries(entityMap)) {
    const found = config.keywords.some((kw) => lowerDesc.includes(kw));
    if (found && !createdTables.has(tableName)) {
      createdTables.add(tableName);
      tables.push({
        id: tableName,
        name: tableName,
        columns: config.columns(),
        position: { x: 0, y: 0 },
      });
    }
  }

  // Auto-add junction tables for orders + products
  if (
    createdTables.has("orders") &&
    createdTables.has("products") &&
    !createdTables.has("order_items")
  ) {
    createdTables.add("order_items");
    tables.push({
      id: "order_items",
      name: "order_items",
      columns: entityMap.order_items.columns(),
      position: { x: 0, y: 0 },
    });
  }

  // Auto-layout in a grid
  tables.forEach((table, i) => {
    table.position = {
      x: 100 + (i % 3) * 350,
      y: 100 + Math.floor(i / 3) * 300,
    };
  });

  return tables;
}

// ─── SQL Export ──────────────────────────────────────────────────────────────

export function exportSchema(
  tables: TableSchema[],
  format: ExportFormat,
): string {
  const lines: string[] = [];

  lines.push(`-- Generated by EasySchema`);
  lines.push(`-- Format: ${format.toUpperCase()}`);
  lines.push(`-- Tables: ${tables.length}`);
  lines.push(``);

  for (const table of tables) {
    lines.push(generateCreateTable(table, format));
    lines.push(``);
  }

  return lines.join("\n");
}

function generateCreateTable(table: TableSchema, format: ExportFormat): string {
  const lines: string[] = [];
  lines.push(`CREATE TABLE ${table.name} (`);

  const colDefs: string[] = [];
  const constraints: string[] = [];

  for (const col of table.columns) {
    let def = `  ${col.name} ${mapType(col.type, format)}`;

    if (col.isPrimaryKey) {
      if (format === "postgresql") {
        def = `  ${col.name} ${col.type === "SERIAL" ? "SERIAL" : mapType(col.type, format)} PRIMARY KEY`;
      } else if (format === "mysql") {
        def = `  ${col.name} INT AUTO_INCREMENT PRIMARY KEY`;
      } else {
        def = `  ${col.name} INTEGER PRIMARY KEY AUTOINCREMENT`;
      }
    } else {
      if (!col.isNullable) def += " NOT NULL";
      if (col.isUnique) def += " UNIQUE";
      if (col.defaultValue) {
        if (col.defaultValue === "NOW()") {
          def +=
            format === "mysql"
              ? " DEFAULT CURRENT_TIMESTAMP"
              : " DEFAULT NOW()";
        } else {
          def += ` DEFAULT ${col.defaultValue}`;
        }
      }
    }

    colDefs.push(def);

    if (col.isForeignKey && col.references) {
      constraints.push(
        `  FOREIGN KEY (${col.name}) REFERENCES ${col.references.table}(${col.references.column})`,
      );
    }
  }

  lines.push([...colDefs, ...constraints].join(",\n"));
  lines.push(`);`);

  return lines.join("\n");
}

function mapType(type: ColumnType, format: ExportFormat): string {
  const typeMap: Record<ExportFormat, Record<string, string>> = {
    postgresql: {
      INT: "INTEGER",
      BIGINT: "BIGINT",
      SERIAL: "SERIAL",
      TEXT: "TEXT",
      VARCHAR: "VARCHAR(255)",
      BOOLEAN: "BOOLEAN",
      DATE: "DATE",
      TIMESTAMP: "TIMESTAMP",
      FLOAT: "REAL",
      DECIMAL: "DECIMAL(10,2)",
      JSON: "JSONB",
      UUID: "UUID",
    },
    mysql: {
      INT: "INT",
      BIGINT: "BIGINT",
      SERIAL: "INT AUTO_INCREMENT",
      TEXT: "TEXT",
      VARCHAR: "VARCHAR(255)",
      BOOLEAN: "TINYINT(1)",
      DATE: "DATE",
      TIMESTAMP: "TIMESTAMP",
      FLOAT: "FLOAT",
      DECIMAL: "DECIMAL(10,2)",
      JSON: "JSON",
      UUID: "CHAR(36)",
    },
    sqlite: {
      INT: "INTEGER",
      BIGINT: "INTEGER",
      SERIAL: "INTEGER",
      TEXT: "TEXT",
      VARCHAR: "TEXT",
      BOOLEAN: "INTEGER",
      DATE: "TEXT",
      TIMESTAMP: "DATETIME",
      FLOAT: "REAL",
      DECIMAL: "REAL",
      JSON: "TEXT",
      UUID: "TEXT",
    },
  };

  return typeMap[format][type] || type;
}

// ─── Join Table Generator ───────────────────────────────────────────────────

export function generateJoinTable(
  tableA: TableSchema,
  tableB: TableSchema,
): TableSchema {
  const name = `${tableA.name}_${tableB.name}`;
  const pkA = tableA.columns.find((c) => c.isPrimaryKey);
  const pkB = tableB.columns.find((c) => c.isPrimaryKey);

  const columns: Column[] = [
    {
      id: `jt-${name}-id`,
      name: "id",
      type: "SERIAL",
      isPrimaryKey: true,
      isForeignKey: false,
      isNullable: false,
      isUnique: true,
    },
    {
      id: `jt-${name}-${tableA.name}_id`,
      name: `${tableA.name}_id`,
      type: pkA?.type === "BIGINT" ? "BIGINT" : "INT",
      isPrimaryKey: false,
      isForeignKey: true,
      isNullable: false,
      isUnique: false,
      references: { table: tableA.id, column: pkA?.name ?? "id" },
    },
    {
      id: `jt-${name}-${tableB.name}_id`,
      name: `${tableB.name}_id`,
      type: pkB?.type === "BIGINT" ? "BIGINT" : "INT",
      isPrimaryKey: false,
      isForeignKey: true,
      isNullable: false,
      isUnique: false,
      references: { table: tableB.id, column: pkB?.name ?? "id" },
    },
    {
      id: `jt-${name}-created`,
      name: "created_at",
      type: "TIMESTAMP",
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: false,
      isUnique: false,
      defaultValue: "NOW()",
    },
  ];

  return {
    id: `jt-${Date.now()}`,
    name,
    columns,
    position: {
      x: (tableA.position.x + tableB.position.x) / 2,
      y: Math.max(tableA.position.y, tableB.position.y) + 280,
    },
  };
}
