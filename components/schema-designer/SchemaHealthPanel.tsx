"use client";

import React, { useEffect } from "react";
import { useSchemaStore } from "@/lib/schema-store";
import {
  healthScoreLabel,
  healthScoreColor,
  healthScoreBgColor,
} from "@/lib/schema-health";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  Shield,
  Zap,
  Palette,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IssueSeverity } from "@/lib/schema-types";

const severityIcon: Record<IssueSeverity, React.ReactNode> = {
  error: <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />,
  warning: (
    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
  ),
  info: <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
};

const severityBg: Record<IssueSeverity, string> = {
  error: "border-red-500/30 bg-red-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  info: "border-blue-400/30 bg-blue-400/5",
};

export function SchemaHealthPanel() {
  const tables = useSchemaStore((s) => s.tables);
  const healthResult = useSchemaStore((s) => s.healthResult);
  const recomputeHealth = useSchemaStore((s) => s.recomputeHealth);
  const selectTable = useSchemaStore((s) => s.selectTable);

  const tableCount = Object.keys(tables).length;

  // Auto-recompute on table/relationship changes
  useEffect(() => {
    if (tableCount > 0) {
      recomputeHealth();
    }
  }, [tables, tableCount, recomputeHealth]);

  if (tableCount === 0 || !healthResult) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Schema Health
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 italic">
          Generate a schema to see health analysis.
        </p>
      </div>
    );
  }

  const { totalScore, breakdown, allIssues } = healthResult;
  const label = healthScoreLabel(totalScore);
  const color = healthScoreColor(totalScore);
  const bgColor = healthScoreBgColor(totalScore);

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  return (
    <div className="space-y-0">
      {/* Header + Score */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Schema Health</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={recomputeHealth}
            title="Refresh health score"
          >
            <RefreshCw className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>

        {/* Big score display */}
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${color}`}>{totalScore}</div>
          <div className="flex-1">
            <div className={`text-xs font-medium ${color}`}>{label}</div>
            <div className="w-full h-2 rounded-full bg-muted mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${bgColor}`}
                style={{ width: `${totalScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Issue counts */}
        <div className="flex gap-3 text-[10px]">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertCircle className="w-3 h-3" />
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          {infoCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Info className="w-3 h-3" />
              {infoCount} info
            </span>
          )}
          {allIssues.length === 0 && (
            <span className="text-green-500">No issues found!</span>
          )}
        </div>
      </div>

      <Separator />

      {/* Breakdown */}
      <div className="p-4 space-y-2.5">
        <span className="text-xs font-medium text-muted-foreground">
          Breakdown
        </span>

        <BreakdownRow
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Structural"
          score={breakdown.structural.score}
          max={breakdown.structural.max}
          issueCount={breakdown.structural.issues.length}
        />
        <BreakdownRow
          icon={<Zap className="w-3.5 h-3.5" />}
          label="Performance"
          score={breakdown.performance.score}
          max={breakdown.performance.max}
          issueCount={breakdown.performance.issues.length}
        />
        <BreakdownRow
          icon={<Palette className="w-3.5 h-3.5" />}
          label="Design"
          score={breakdown.design.score}
          max={breakdown.design.max}
          issueCount={breakdown.design.issues.length}
        />
      </div>

      {/* Issues list */}
      {allIssues.length > 0 && (
        <>
          <Separator />
          <div className="p-4 space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Issues ({allIssues.length})
            </span>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {allIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`px-3 py-2 rounded-lg border text-xs ${severityBg[issue.severity]} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => {
                    if (issue.tableId) selectTable(issue.tableId);
                  }}
                >
                  <div className="flex items-start gap-2">
                    {severityIcon[issue.severity]}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">
                        {issue.title}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {issue.description}
                      </div>
                      {issue.suggestion && (
                        <div className="text-primary/80 mt-1 flex items-start gap-1">
                          <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{issue.suggestion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function BreakdownRow({
  icon,
  label,
  score,
  max,
  issueCount,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  max: number;
  issueCount: number;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color =
    pct >= 80
      ? "text-green-500"
      : pct >= 60
        ? "text-blue-500"
        : pct >= 40
          ? "text-yellow-500"
          : "text-red-500";
  const barColor =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
        ? "bg-blue-500"
        : pct >= 40
          ? "bg-yellow-500"
          : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {issueCount > 0 && (
            <span className="text-[10px] text-muted-foreground/60">
              {issueCount} issue{issueCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className={`font-medium ${color}`}>
            {score}/{max}
          </span>
        </div>
      </div>
      <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
