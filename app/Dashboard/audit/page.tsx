"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useSchemaStore } from "@/lib/schema-store";
import type { SchemaHealthResult } from "@/lib/schema-types";
import type { PerformanceSimulationResult } from "@/lib/audit/performanceSimulation";
import type { FixPlan, FixExecutionResult } from "@/lib/audit/fix-types";
import { extractCanvasSchema } from "@/lib/audit/schemaExtraction";
import { emitRtcEvent } from "@/lib/rtc/emitter";

type AuditResponse = {
  health: SchemaHealthResult;
  performanceSimulation: PerformanceSimulationResult;
};

export default function AuditPage() {
  const tables = useSchemaStore((s) => s.tables);
  const relationships = useSchemaStore((s) => s.relationships);
  const indexes = useSchemaStore((s) => s.indexes);

  const tablesArray = useMemo(() => Object.values(tables), [tables]);
  const relationshipsArray = useMemo(
    () => Object.values(relationships),
    [relationships],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditResponse | null>(null);
  const [fixPlan, setFixPlan] = useState<FixPlan | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [execution, setExecution] = useState<FixExecutionResult | null>(null);
  const [expandedSql, setExpandedSql] = useState<Record<string, boolean>>({});

  const getFixStatus = (fixId: string) => {
    if (!execution) return "pending";
    if (execution.applied.some((item) => item.id === fixId)) return "applied";
    if (execution.failed.some((item) => item.fix.id === fixId)) return "failed";
    if (execution.skipped.some((item) => item.id === fixId)) return "skipped";
    return "pending";
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      applied: "bg-emerald-500/10 text-emerald-600",
      failed: "bg-red-500/10 text-red-600",
      skipped: "bg-amber-500/10 text-amber-600",
      pending: "bg-muted text-muted-foreground",
    };
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
          styles[status] ?? styles.pending
        }`}
      >
        {label}
      </span>
    );
  };

  const canAnalyze = useMemo(
    () => tablesArray.length > 0,
    [tablesArray.length],
  );

  const runSimulation = async () => {
    const emit = true;
    emitRtcEvent("RUN_AUDIT", { reason: "manual" });
    return runSimulationInternal(emit);
  };

  const runSimulationInternal = useCallback(
    async (emit: boolean) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/audit/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tables: tablesArray,
            relationships: relationshipsArray,
            indexes,
          }),
        });

        const data = (await res.json()) as AuditResponse & { error?: string };

        if (!res.ok) {
          setError(data.error ?? "Failed to run audit simulation");
          return;
        }

        setReport(data);
        setFixPlan(null);
        setExecution(null);
        if (emit) {
          emitRtcEvent("AUDIT_RESULT", {
            summaryScore: data.performanceSimulation?.summaryScore,
          });
        }
      } catch {
        setError("Unable to run audit simulation right now.");
      } finally {
        setLoading(false);
      }
    },
    [tablesArray, relationshipsArray, indexes],
  );

  const buildFixPayload = () => {
    if (!report) return null;
    return {
      schema: extractCanvasSchema(),
      audit: report.health,
      performance: report.performanceSimulation,
      aiFixes: [],
    };
  };

  const generateFixPlan = async () => {
    const payload = buildFixPayload();
    if (!payload) return;
    setFixLoading(true);
    setFixError(null);
    try {
      const res = await fetch("/api/audit/fixes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as FixPlan & { error?: string };
      if (!res.ok) {
        setFixError(data.error ?? "Failed to generate fix plan");
        return;
      }
      setFixPlan(data);
    } catch {
      setFixError("Unable to generate fix plan right now.");
    } finally {
      setFixLoading(false);
    }
  };

  const applyAllSafe = async () => {
    const payload = buildFixPayload();
    if (!payload) return;
    setFixLoading(true);
    setFixError(null);
    try {
      const res = await fetch("/api/audit/fixes/apply-safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        result: FixExecutionResult;
        error?: string;
      };
      if (!res.ok) {
        setFixError(data.error ?? "Failed to apply safe fixes");
        return;
      }
      setExecution(data.result);
      emitRtcEvent("APPLY_ALL_SAFE_FIXES", { runId: data.result.runId });
      await runSimulationInternal(false);
    } catch {
      setFixError("Unable to apply fixes right now.");
    } finally {
      setFixLoading(false);
    }
  };

  const applyFix = async (fixId: string) => {
    const payload = buildFixPayload();
    if (!payload) return;
    setFixLoading(true);
    setFixError(null);
    try {
      const res = await fetch("/api/audit/fixes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, fixIds: [fixId] }),
      });
      const data = (await res.json()) as {
        result: FixExecutionResult;
        error?: string;
      };
      if (!res.ok) {
        setFixError(data.error ?? "Failed to apply fix");
        return;
      }
      setExecution(data.result);
      emitRtcEvent("APPLY_FIX", { fixId, runId: data.result.runId });
      await runSimulationInternal(false);
    } catch {
      setFixError("Unable to apply fix right now.");
    } finally {
      setFixLoading(false);
    }
  };

  const rollbackFix = async (fixId: string) => {
    if (!execution?.runId) return;
    const payload = buildFixPayload();
    if (!payload) return;
    setFixLoading(true);
    setFixError(null);
    try {
      const res = await fetch("/api/audit/fixes/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          runId: execution.runId,
          fixId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFixError(data.error ?? "Failed to rollback fix");
        return;
      }
      await runSimulationInternal(false);
    } catch {
      setFixError("Unable to rollback fix right now.");
    } finally {
      setFixLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      runSimulationInternal(false);
    };
    window.addEventListener("rtc:audit", handler as EventListener);
    return () =>
      window.removeEventListener("rtc:audit", handler as EventListener);
  }, [runSimulationInternal]);

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
          <span>Tables: {tablesArray.length}</span>
          <span>Relationships: {relationshipsArray.length}</span>
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

          <article className="rounded-2xl border bg-card p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold">Apply Fixes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Convert audit issues into safe fixes you can apply to the
              database.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={generateFixPlan} disabled={fixLoading}>
                {fixLoading ? "Building Fix Plan..." : "Generate Fix Plan"}
              </Button>
              <Button
                variant="outline"
                onClick={applyAllSafe}
                disabled={fixLoading || !fixPlan}
              >
                Apply All Safe Fixes
              </Button>
            </div>

            {fixError && (
              <p className="mt-3 text-sm text-destructive">{fixError}</p>
            )}

            {fixPlan && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Safe fixes: {fixPlan.fixes.length} · Manual review:{" "}
                    {fixPlan.unsafeFixes.length}
                  </span>
                  <span>
                    Generated: {new Date(fixPlan.generatedAt).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2">
                  {fixPlan.fixes.map((fix) => (
                    <div key={fix.id} className="rounded border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {fix.issueTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Risk: {fix.riskLevel} · Source: {fix.source}
                          </p>
                          <div className="mt-1">
                            {statusBadge(getFixStatus(fix.id))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setExpandedSql((prev) => ({
                                ...prev,
                                [fix.id]: !prev[fix.id],
                              }))
                            }
                          >
                            {expandedSql[fix.id] ? "Hide SQL" : "View SQL"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => applyFix(fix.id)}
                            disabled={fixLoading}
                          >
                            Apply Fix
                          </Button>
                          {execution?.applied.some(
                            (applied) => applied.id === fix.id,
                          ) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rollbackFix(fix.id)}
                              disabled={fixLoading}
                            >
                              Rollback
                            </Button>
                          )}
                        </div>
                      </div>
                      {expandedSql[fix.id] && (
                        <pre className="mt-3 whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                          {fix.sql}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>

                {fixPlan.unsafeFixes.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium">Manual Review</h3>
                    <div className="mt-2 space-y-2">
                      {fixPlan.unsafeFixes.map((fix) => (
                        <div
                          key={fix.id}
                          className="rounded border p-3 text-sm"
                        >
                          <p className="font-medium text-foreground">
                            {fix.issueTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Risk: {fix.riskLevel} ·{" "}
                            {fix.safetyReason ?? "Requires review"}
                          </p>
                          {fix.sql && (
                            <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                              {fix.sql}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
