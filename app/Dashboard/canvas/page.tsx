"use client";

import { useEffect } from "react";
import { SchemaNavbar } from "@/components/schema-designer/SchemaNavbar";
import { AssistantSidebar } from "@/components/schema-designer/AssistantSidebar";
import { SchemaCanvas } from "@/components/schema-designer/SchemaCanvas";
import { PropertiesPanel } from "@/components/schema-designer/PropertiesPanel";
import { useSchemaStore } from "@/lib/schema-store";

export default function SchemaDesignerPage() {
  const undo = useSchemaStore((s) => s.undo);
  const redo = useSchemaStore((s) => s.redo);

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

  return (
    <div className="h-screen flex flex-col">
      {/* Fixed Navbar */}
      <SchemaNavbar />

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
