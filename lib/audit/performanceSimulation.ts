import type { Relationship, TableIndex, TableSchema } from "@/lib/schema-types";

export type SimulationRisk = "low" | "medium" | "high";

export interface QueryScenarioResult {
  name: string;
  description: string;
  estimatedQueries: number;
  estimatedP95LatencyMs: number;
  risk: SimulationRisk;
  notes: string[];
}

export interface PerformanceSimulationResult {
  summaryScore: number;
  estimatedP95LatencyMs: number;
  nPlusOneRiskCount: number;
  bottlenecks: string[];
  recommendations: string[];
  scenarios: QueryScenarioResult[];
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function riskFromLatency(latency: number): SimulationRisk {
  if (latency >= 900) return "high";
  if (latency >= 350) return "medium";
  return "low";
}

function getIndexedColumns(indexes: Record<string, TableIndex[]>): Set<string> {
  const set = new Set<string>();
  for (const [tableId, tableIndexes] of Object.entries(indexes)) {
    for (const idx of tableIndexes ?? []) {
      for (const colId of idx.columns ?? []) {
        set.add(`${tableId}:${colId}`);
      }
    }
  }
  return set;
}

export function simulateAuditPerformance(
  tables: TableSchema[],
  relationships: Relationship[],
  indexes: Record<string, TableIndex[]> = {},
): PerformanceSimulationResult {
  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  const oneToMany = relationships.filter((r) => r.type === "one-to-many");
  const manyToMany = relationships.filter((r) => r.type === "many-to-many");
  const totalTables = tables.length;

  // Fan-out map: parent table -> outgoing children count
  const fanOut = new Map<string, number>();
  for (const rel of oneToMany) {
    fanOut.set(rel.sourceTableId, (fanOut.get(rel.sourceTableId) ?? 0) + 1);
  }

  // Index coverage on relationship source columns
  const indexedColumns = getIndexedColumns(indexes);
  let unindexedRelationshipCount = 0;
  for (const rel of relationships) {
    const key = `${rel.sourceTableId}:${rel.sourceColumnId}`;
    if (!indexedColumns.has(key)) {
      unindexedRelationshipCount += 1;
    }
  }

  const highFanOutParents = [...fanOut.entries()].filter(
    ([, count]) => count >= 3,
  );

  const nPlusOneRiskCount = highFanOutParents.length + manyToMany.length;

  if (highFanOutParents.length > 0) {
    for (const [parent, childCount] of highFanOutParents) {
      bottlenecks.push(
        `Potential N+1 hotspot: ${parent} has ${childCount} one-to-many branches.`,
      );
    }
    recommendations.push(
      "Use eager loading or batched fetches for list/detail reads on high fan-out entities.",
    );
  }

  if (manyToMany.length > 0) {
    bottlenecks.push(
      `Many-to-many paths detected (${manyToMany.length}). These can trigger query explosion in ORMs.`,
    );
    recommendations.push(
      "Preload many-to-many edges with joins on junction tables and avoid per-row relation fetches.",
    );
  }

  if (unindexedRelationshipCount > 0) {
    bottlenecks.push(
      `${unindexedRelationshipCount} relationship columns appear unindexed, increasing scan costs.`,
    );
    recommendations.push(
      "Add indexes on foreign key columns participating in frequent joins/filtering.",
    );
  }

  const structuralLoad =
    totalTables * 12 + relationships.length * 24 + manyToMany.length * 65;

  const listEstimatedQueries =
    1 +
    clamp(
      oneToMany.length * 2 +
        highFanOutParents.length * 6 +
        manyToMany.length * 3,
      0,
      300,
    );

  const detailEstimatedQueries =
    1 + clamp(relationships.length + highFanOutParents.length * 4, 0, 240);

  const analyticsEstimatedQueries = clamp(
    4 + Math.round(totalTables / 2) + manyToMany.length * 2,
    1,
    200,
  );

  const listLatency = clamp(
    120 + listEstimatedQueries * 7 + unindexedRelationshipCount * 25,
    80,
    3000,
  );
  const detailLatency = clamp(
    90 + detailEstimatedQueries * 6 + unindexedRelationshipCount * 18,
    60,
    2600,
  );
  const analyticsLatency = clamp(
    180 + analyticsEstimatedQueries * 9 + manyToMany.length * 30,
    120,
    4000,
  );

  const scenarios: QueryScenarioResult[] = [
    {
      name: "List Endpoint Simulation",
      description:
        "Loads parent rows with related child records in application loops.",
      estimatedQueries: listEstimatedQueries,
      estimatedP95LatencyMs: listLatency,
      risk: riskFromLatency(listLatency),
      notes: [
        "Typical example: /orders with customer and items in a loop.",
        "Main risk driver: one-to-many fan-out and relation fetch strategy.",
      ],
    },
    {
      name: "Detail Endpoint Simulation",
      description: "Loads one root entity and traverses nested relations.",
      estimatedQueries: detailEstimatedQueries,
      estimatedP95LatencyMs: detailLatency,
      risk: riskFromLatency(detailLatency),
      notes: [
        "Typical example: /customer/:id with orders, payments, and addresses.",
        "Main risk driver: deep relation traversal without batching.",
      ],
    },
    {
      name: "Reporting Query Simulation",
      description: "Aggregated joins for dashboard/report endpoints.",
      estimatedQueries: analyticsEstimatedQueries,
      estimatedP95LatencyMs: analyticsLatency,
      risk: riskFromLatency(analyticsLatency),
      notes: [
        "Typical example: revenue + fulfillment + customer activity report.",
        "Main risk driver: many-to-many joins and missing FK indexes.",
      ],
    },
  ];

  const estimatedP95LatencyMs = Math.max(
    ...scenarios.map((scenario) => scenario.estimatedP95LatencyMs),
  );

  const penalty =
    nPlusOneRiskCount * 8 +
    unindexedRelationshipCount * 4 +
    clamp(structuralLoad / 120, 0, 30);

  const summaryScore = clamp(Math.round(100 - penalty), 0, 100);

  if (recommendations.length === 0) {
    recommendations.push(
      "Current schema shape looks balanced. Keep validating with realistic production query traces.",
    );
  }

  return {
    summaryScore,
    estimatedP95LatencyMs,
    nPlusOneRiskCount,
    bottlenecks,
    recommendations,
    scenarios,
  };
}
