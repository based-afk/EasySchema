"use client";

import React from "react";
import { useSchemaStore } from "@/lib/schema-store";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { History, Save, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { healthScoreColor } from "@/lib/schema-health";
import { computeScoreTrend } from "@/lib/version-history";

export function VersionHistoryPanel() {
  const tables = useSchemaStore((s) => s.tables);
  const schemaVersions = useSchemaStore((s) => s.schemaVersions);
  const saveVersion = useSchemaStore((s) => s.saveVersion);

  const tableCount = Object.keys(tables).length;
  const trend = computeScoreTrend(schemaVersions);

  return (
    <div className="space-y-0">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Version History</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => saveVersion()}
            disabled={tableCount === 0}
            title="Save current schema as a version"
          >
            <Save className="w-3 h-3" />
            Save
          </Button>
        </div>

        {schemaVersions.length >= 2 && (
          <div className="flex items-center gap-2 text-xs">
            {trend.improving ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : trend.delta < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">
              {trend.delta > 0 ? "+" : ""}
              {trend.delta} health score over last{" "}
              {Math.min(5, schemaVersions.length)} versions
            </span>
          </div>
        )}
      </div>

      <Separator />

      <div className="p-4 space-y-2">
        {schemaVersions.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">
            No versions saved yet. Click Save to create a snapshot.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {[...schemaVersions].reverse().map((version) => (
              <div
                key={version.id}
                className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    v{version.versionNumber}
                  </span>
                  <span
                    className={`font-medium ${healthScoreColor(version.healthScore)}`}
                  >
                    {version.healthScore}/100
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-muted-foreground">
                  <span>
                    {version.tables.length} table
                    {version.tables.length !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {new Date(version.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {version.description && (
                  <div className="mt-1 text-muted-foreground/80 italic">
                    {version.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
