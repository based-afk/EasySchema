"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSchemaStore } from "@/lib/schema-store";
import type { SchemaHealthResult } from "@/lib/schema-types";
import type { PerformanceSimulationResult } from "@/lib/audit/performanceSimulation";

type AuditResponse = {
  health: SchemaHealthResult;
  performanceSimulation: PerformanceSimulationResult;
};

export default function AuditPage() {
  const tables = useSchemaStore((s) => s.getTablesArray());
  const relationships = useSchemaStore((s) => s.getRelationshipsArray());
  const indexes = useSchemaStore((s) => s.indexes);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditResponse | null>(null);

  const canAnalyze = useMemo(() => tables.length > 0, [tables.length]);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/audit/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables,
          relationships,
          indexes,
        }),
      });

      const data = (await res.json()) as AuditResponse & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to run audit simulation");
        return;
      }

      setReport(data);
    } catch {
      setError("Unable to run audit simulation right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit & Performance Analysis
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Run a bottleneck simulation on your current Studio canvas. This
          includes health scoring, N+1 risk detection, and estimated query
          performance.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Tables: {tables.length}</span>
          <span>Relationships: {relationships.length}</span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={runSimulation} disabled={!canAnalyze || loading}>
            {loading ? "Running Analysis..." : "Run Audit Simulation"}
          </Button>
          {!canAnalyze && (
            <span className="text-sm text-muted-foreground">
              Add at least one table in Studio before analysis.
            </span>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </section>

      {report && (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Schema Health</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Overall score: {report.health.totalScore}/{report.health.maxScore}
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded border p-2">
                <span>Structural</span>
                <span>
                  {report.health.breakdown.structural.score}/
                  {report.health.breakdown.structural.max}
                </span>
              </div>
              <div className="flex items-center justify-between rounded border p-2">
                <span>Performance</span>
                <span>
                  {report.health.breakdown.performance.score}/
                  {report.health.breakdown.performance.max}
                </span>
              </div>
              <div className="flex items-center justify-between rounded border p-2">
                <span>Design</span>
                <span>
                  {report.health.breakdown.design.score}/
                  {report.health.breakdown.design.max}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Top Issues</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {report.health.allIssues.slice(0, 6).map((issue) => (
                  <li key={issue.id} className="rounded border p-2">
                    <p className="font-medium text-foreground">{issue.title}</p>
                    <p>{issue.description}</p>
                  </li>
                ))}
                {report.health.allIssues.length === 0 && (
                  <li className="rounded border p-2">
                    No major issues detected.
                  </li>
                )}
              </ul>
            </div>
          </article>

          <article className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Bottleneck Simulation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Performance score: {report.performanceSimulation.summaryScore}/100
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border p-3">
                <p className="text-muted-foreground">Estimated P95 Latency</p>
                <p className="text-lg font-semibold">
                  {report.performanceSimulation.estimatedP95LatencyMs} ms
                </p>
              </div>
              <div className="rounded border p-3">
                <p className="text-muted-foreground">N+1 Risks</p>
                <p className="text-lg font-semibold">
                  {report.performanceSimulation.nPlusOneRiskCount}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Detected Bottlenecks</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {report.performanceSimulation.bottlenecks.map((item) => (
                  <li key={item} className="rounded border p-2">
                    {item}
                  </li>
                ))}
                {report.performanceSimulation.bottlenecks.length === 0 && (
                  <li className="rounded border p-2">
                    No major bottlenecks detected.
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Scenario Simulation</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {report.performanceSimulation.scenarios.map((scenario) => (
                  <li key={scenario.name} className="rounded border p-3">
                    <p className="font-medium">{scenario.name}</p>
                    <p className="text-muted-foreground">
                      {scenario.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Queries: {scenario.estimatedQueries}</span>
                      <span>P95: {scenario.estimatedP95LatencyMs} ms</span>
                      <span>Risk: {scenario.risk}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Recommendations</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {report.performanceSimulation.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
