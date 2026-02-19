"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExportFormat, SavedSchema } from "@/lib/schema-types";
import { exportSchema, generateJoinTable } from "@/lib/schema-utils";
import { importSQL } from "@/lib/sql-import";
import { autoLayoutTables } from "@/lib/auto-layout";
import { useSchemaStore } from "@/lib/schema-store";
import {
  ArrowLeft,
  Download,
  Check,
  Copy,
  ChevronDown,
  Database,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
  Upload,
  LayoutGrid,
  Link2,
} from "lucide-react";
import Link from "next/link";

const formatLabels: Record<ExportFormat, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

const STORAGE_KEY = "easyschema-saved";

export function SchemaNavbar() {
  const tables = useSchemaStore((s) => s.tables);
  const relationships = useSchemaStore((s) => s.relationships);
  const schemaName = useSchemaStore((s) => s.schemaName);
  const setSchemaName = useSchemaStore((s) => s.setSchemaName);
  const setTables = useSchemaStore((s) => s.setTables);
  const addTable = useSchemaStore((s) => s.addTable);
  const addRelationship = useSchemaStore((s) => s.addRelationship);
  const getTablesArray = useSchemaStore((s) => s.getTablesArray);
  const getRelationshipsArray = useSchemaStore((s) => s.getRelationshipsArray);
  const undo = useSchemaStore((s) => s.undo);
  const redo = useSchemaStore((s) => s.redo);
  const canUndo = useSchemaStore((s) => s.canUndo);
  const canRedo = useSchemaStore((s) => s.canRedo);

  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("postgresql");
  const [copied, setCopied] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [joinA, setJoinA] = useState("");
  const [joinB, setJoinB] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sqlInputRef = useRef<HTMLInputElement>(null);

  const tablesArray = getTablesArray();
  const tableCount = tablesArray.length;
  const sql = exportSchema(tablesArray, exportFormat);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schemaName || "schema"}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Save / Load ─────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const data: SavedSchema = {
      version: 1,
      name: schemaName,
      tables: tablesArray,
      relationships: getRelationshipsArray(),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Also download as JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schemaName || "schema"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [schemaName, tablesArray, getRelationshipsArray]);

  const handleLoadFromFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as SavedSchema;
          if (data.tables) {
            setSchemaName(data.name ?? "Imported Schema");
            setTables(data.tables);
          }
        } catch {
          console.error("Failed to parse JSON file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setSchemaName, setTables],
  );

  const handleLoadFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as SavedSchema;
      if (data.tables) {
        setSchemaName(data.name ?? "Loaded Schema");
        setTables(data.tables);
      }
    } catch {
      console.error("Failed to load from localStorage");
    }
  }, [setSchemaName, setTables]);

  // ── SQL Import ──────────────────────────────────────────────────────

  const handleSQLImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const sqlContent = ev.target?.result as string;
        const imported = importSQL(sqlContent);
        if (imported.length > 0) {
          setTables(imported);
          setSchemaName(file.name.replace(/\.sql$/i, "") || "Imported Schema");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setTables, setSchemaName],
  );

  // ── Auto layout ─────────────────────────────────────────────────────

  const handleAutoLayout = useCallback(() => {
    const relsArr = getRelationshipsArray();
    const laid = autoLayoutTables(tablesArray, relsArr);
    setTables(laid);
  }, [tablesArray, getRelationshipsArray, setTables]);

  // ── Join table ──────────────────────────────────────────────────────

  const handleCreateJoin = useCallback(() => {
    const tA = tables[joinA];
    const tB = tables[joinB];
    if (!tA || !tB || joinA === joinB) return;
    const jt = generateJoinTable(tA, tB);
    addTable(jt);
    // Create relationships to both tables
    const fkA = jt.columns.find((c) => c.references?.table === tA.id);
    const fkB = jt.columns.find((c) => c.references?.table === tB.id);
    const pkA = tA.columns.find((c) => c.isPrimaryKey);
    const pkB = tB.columns.find((c) => c.isPrimaryKey);
    if (fkA && pkA) {
      addRelationship({
        id: `rel-jt-${jt.id}-a`,
        sourceTableId: jt.id,
        sourceColumnId: fkA.id,
        targetTableId: tA.id,
        targetColumnId: pkA.id,
        type: "one-to-many",
        onDelete: "CASCADE",
      });
    }
    if (fkB && pkB) {
      addRelationship({
        id: `rel-jt-${jt.id}-b`,
        sourceTableId: jt.id,
        sourceColumnId: fkB.id,
        targetTableId: tB.id,
        targetColumnId: pkB.id,
        type: "one-to-many",
        onDelete: "CASCADE",
      });
    }
    setJoinA("");
    setJoinB("");
  }, [tables, joinA, joinB, addTable, addRelationship]);

  return (
    <>
      <nav className="h-14 w-full border-b border-border bg-background px-4 flex items-center justify-between gap-4 flex-shrink-0">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <input
              type="text"
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value)}
              className="bg-transparent text-sm font-medium border-none outline-none focus:ring-0 w-40 placeholder:text-muted-foreground"
              placeholder="Untitled Schema"
            />
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tableCount} table{tableCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Center — Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo()}
            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          {/* Auto-layout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoLayout}
            disabled={tableCount === 0}
            title="Auto-layout tables"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </Button>

          {/* Tools (join, import SQL) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTools(!showTools)}
            className="gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" />
            Tools
          </Button>

          {/* Save */}
          <Button variant="ghost" size="sm" onClick={handleSave} title="Save">
            <Save className="w-3.5 h-3.5" />
          </Button>

          {/* Load */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Load JSON"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleLoadFromFile}
          />

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExport(!showExport)}
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showExport ? "rotate-180" : ""}`}
            />
          </Button>
        </div>
      </nav>

      {/* Tools Panel */}
      {showTools && (
        <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-6 flex-wrap">
            {/* SQL Import */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Import SQL:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => sqlInputRef.current?.click()}
                className="gap-1.5 text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Choose .sql
              </Button>
              <input
                ref={sqlInputRef}
                type="file"
                accept=".sql"
                className="hidden"
                onChange={handleSQLImport}
              />
            </div>

            {/* Load from localStorage */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadFromStorage}
              className="gap-1.5 text-xs"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Load Last Save
            </Button>

            {/* Join Table Generator */}
            {tableCount >= 2 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Join Table:
                </span>
                <select
                  value={joinA}
                  onChange={(e) => setJoinA(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-border bg-muted/30 outline-none"
                >
                  <option value="">Table A</option>
                  {tablesArray.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">×</span>
                <select
                  value={joinB}
                  onChange={(e) => setJoinB(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-border bg-muted/30 outline-none"
                >
                  <option value="">Table B</option>
                  {tablesArray.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateJoin}
                  disabled={!joinA || !joinB || joinA === joinB}
                  className="text-xs"
                >
                  Create
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Panel */}
      {showExport && (
        <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs text-muted-foreground">Format:</span>
            <div className="flex gap-1.5">
              {(Object.keys(formatLabels) as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`px-3 py-1 rounded-md text-xs transition-colors ${
                    exportFormat === fmt
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {formatLabels[fmt]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="gap-1.5 text-xs"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                className="gap-1.5 text-xs"
                disabled={tableCount === 0}
              >
                <Download className="w-3.5 h-3.5" />
                Download .sql
              </Button>
            </div>
          </div>

          {/* SQL Preview */}
          {tableCount > 0 ? (
            <pre className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-foreground font-mono overflow-auto max-h-48 whitespace-pre">
              {sql}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground italic py-2">
              Generate a schema first to see the export preview.
            </p>
          )}
        </div>
      )}
    </>
  );
}
