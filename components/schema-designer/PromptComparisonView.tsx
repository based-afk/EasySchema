"use client";

import React from "react";
import { useSchemaStore } from "@/lib/schema-store";
import { Separator } from "@/components/ui/separator";
import { computePromptImprovement } from "@/lib/prompt-intelligence";
import { GitCompare, Sparkles, TrendingUp } from "lucide-react";

export function PromptComparisonView() {
  const promptHistory = useSchemaStore((s) => s.promptHistory);
  const stats = computePromptImprovement(promptHistory);

  if (promptHistory.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">Prompt History</span>
        </div>

        {/* Stats */}
        {promptHistory.length >= 2 && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Improvement"
              value={`${stats.totalImprovement >= 0 ? "+" : ""}${stats.totalImprovement}`}
              color={
                stats.totalImprovement > 0 ? "text-green-500" : "text-red-400"
              }
            />
            <StatCard
              label="Best"
              value={`${stats.bestScore}`}
              color="text-primary"
            />
            <StatCard
              label="Versions"
              value={`${stats.versionCount}`}
              color="text-muted-foreground"
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Version table */}
      <div className="p-4">
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_50px_50px] gap-2 text-[9px] text-muted-foreground/60 uppercase tracking-wider px-2">
            <span className="w-4" />
            <span>Prompt</span>
            <span className="text-right">Rule</span>
            <span className="text-right">Score</span>
          </div>

          {[...promptHistory].reverse().map((version, i) => (
            <div
              key={version.id}
              className="grid grid-cols-[auto_1fr_50px_50px] gap-2 items-center px-2 py-1.5 rounded-lg bg-muted/20 border border-border text-xs"
            >
              <div className="flex items-center justify-center w-4">
                {version.isRefined ? (
                  <Sparkles className="w-3 h-3 text-primary" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {promptHistory.length - i}
                  </span>
                )}
              </div>
              <div
                className="truncate text-muted-foreground"
                title={version.text}
              >
                {version.text.slice(0, 60)}
                {version.text.length > 60 ? "…" : ""}
              </div>
              <div className="text-right font-mono text-muted-foreground">
                {version.ruleScore}
              </div>
              <div
                className={`text-right font-mono font-medium ${scoreColor(version.combinedScore)}`}
              >
                {version.combinedScore}
              </div>
            </div>
          ))}
        </div>

        {promptHistory.length >= 2 && stats.totalImprovement > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-green-500">
            <TrendingUp className="w-3 h-3" />
            <span>
              Users improved by {stats.totalImprovement} points across{" "}
              {stats.versionCount} versions
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="px-2 py-1.5 rounded-lg bg-muted/30 border border-border text-center">
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 40) return "text-yellow-500";
  return "text-red-400";
}
