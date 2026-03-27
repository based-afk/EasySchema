"use client";

import { useEffect, useState } from "react";
import { SchemaNavbar } from "@/components/schema-designer/SchemaNavbar";
import { AssistantSidebar } from "@/components/schema-designer/AssistantSidebar";
import { SchemaCanvas } from "@/components/schema-designer/SchemaCanvas";
import { PropertiesPanel } from "@/components/schema-designer/PropertiesPanel";
import { useSchemaStore } from "@/lib/schema-store";

export default function SchemaDesignerPage() {
  const undo = useSchemaStore((s) => s.undo);
  const redo = useSchemaStore((s) => s.redo);
  const [remoteEditor, setRemoteEditor] = useState<{
    name: string;
    isEditing: boolean;
  } | null>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (
        ctrl &&
        e.key === "z" &&
        !e.shiftKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        undo();
      }
      if (
        ctrl &&
        (e.key === "y" || (e.key === "z" && e.shiftKey)) &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent;
      const detail = custom.detail as
        | { payload?: { name?: string; isEditing?: boolean; scope?: string } }
        | undefined;
      if (!detail?.payload || detail.payload.scope !== "schema") return;
      if (!detail.payload.isEditing) {
        setRemoteEditor(null);
        return;
      }
      setRemoteEditor({
        name: detail.payload.name || "Someone",
        isEditing: Boolean(detail.payload.isEditing),
      });
    };
    window.addEventListener("rtc:editor", handler as EventListener);
    return () =>
      window.removeEventListener("rtc:editor", handler as EventListener);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Fixed Navbar */}
      <SchemaNavbar />

      {remoteEditor?.isEditing && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {remoteEditor.name} is editing the schema right now. You can keep
          working, but changes may overlap.
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <AssistantSidebar />

        {/* Canvas Area */}
        <SchemaCanvas />

        {/* Right Properties Panel */}
        <PropertiesPanel />
      </div>
    </div>
  );
}
