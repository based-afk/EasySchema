// ─── Schema Version Persistence ───────────────────────────────────────────────
//
// Saves schema versions to the `schema_versions` PostgreSQL table.
// ─────────────────────────────────────────────────────────────────────────────

import { query, queryOne } from "../db";
import type { SchemaNode, SchemaEdge } from "../ai/types";

export interface SavedVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  name?: string;
  description?: string;
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  promptText?: string;
  createdAt: string;
}

/**
 * Get the next version number for a project.
 */
async function getNextVersionNumber(projectId: string): Promise<number> {
  const row = await queryOne<{ max_ver: number | null }>(
    `SELECT MAX(version_number) AS max_ver FROM schema_versions WHERE project_id = $1`,
    [projectId],
  );
  return (row?.max_ver ?? 0) + 1;
}

/**
 * Save a new schema version for a project.
 */
export async function saveSchemaVersion(opts: {
  projectId: string;
  name?: string;
  description?: string;
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  healthScore?: number;
  promptScore?: number;
  promptText?: string;
}): Promise<SavedVersion> {
  const versionNumber = await getNextVersionNumber(opts.projectId);

  const row = await queryOne<{
    id: string;
    project_id: string;
    version_number: number;
    name: string | null;
    description: string | null;
    tables: SchemaNode[];
    relationships: SchemaEdge[];
    prompt_text: string | null;
    created_at: string;
  }>(
    `INSERT INTO schema_versions
       (project_id, version_number, name, description, tables, relationships,
        health_score, prompt_score, prompt_text, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, NOW())
     RETURNING *`,
    [
      opts.projectId,
      versionNumber,
      opts.name ?? `Version ${versionNumber}`,
      opts.description ?? null,
      JSON.stringify(opts.nodes),
      JSON.stringify(opts.edges),
      opts.healthScore ?? null,
      opts.promptScore ?? null,
      opts.promptText ?? null,
    ],
  );

  if (!row) throw new Error("Failed to insert schema version");

  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    nodes: row.tables,
    edges: row.relationships,
    promptText: row.prompt_text ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Get all versions for a project, ordered by version number.
 */
export async function getProjectVersions(
  projectId: string,
): Promise<SavedVersion[]> {
  const result = await query<{
    id: string;
    project_id: string;
    version_number: number;
    name: string | null;
    description: string | null;
    tables: SchemaNode[];
    relationships: SchemaEdge[];
    prompt_text: string | null;
    created_at: string;
  }>(
    `SELECT id, project_id, version_number, name, description, tables, relationships, prompt_text, created_at
     FROM schema_versions
     WHERE project_id = $1
     ORDER BY version_number ASC`,
    [projectId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    nodes: row.tables,
    edges: row.relationships,
    promptText: row.prompt_text ?? undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Get the latest schema version for a project.
 */
export async function getLatestVersion(
  projectId: string,
): Promise<SavedVersion | null> {
  const row = await queryOne<{
    id: string;
    project_id: string;
    version_number: number;
    name: string | null;
    description: string | null;
    tables: SchemaNode[];
    relationships: SchemaEdge[];
    prompt_text: string | null;
    created_at: string;
  }>(
    `SELECT id, project_id, version_number, name, description, tables, relationships, prompt_text, created_at
     FROM schema_versions
     WHERE project_id = $1
     ORDER BY version_number DESC
     LIMIT 1`,
    [projectId],
  );

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    nodes: row.tables,
    edges: row.relationships,
    promptText: row.prompt_text ?? undefined,
    createdAt: row.created_at,
  };
}
