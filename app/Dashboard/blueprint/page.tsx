"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowUp, Trash2 } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

const RECOMMENDATIONS = [
  "Coffee shop with products, orders, payments, and inventory",
  "SaaS app with organizations, users, roles, and billing",
  "E-commerce with carts, orders, shipments, and returns",
  "Hospital system with patients, doctors, visits, and prescriptions",
];

export default function BlueprintPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Keep this in session memory only by default: no DB/localStorage persistence.
  const keepHistory = false;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const submitPrompt = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Blueprint captured. Move to Studio to generate and analyze your schema.",
      createdAt: Date.now(),
    };

    if (keepHistory) {
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
    } else {
      setMessages([userMessage, assistantMessage]);
    }

    setPrompt("");
  };

  const continueToStudio = () => {
    // Optional handoff value for future Studio ingestion support.
    const latestPrompt = messages
      .filter((m) => m.role === "user")
      .at(-1)
      ?.content.trim();

    if (latestPrompt) {
      router.push(
        `/Dashboard/canvas?blueprintPrompt=${encodeURIComponent(latestPrompt)}`,
      );
      return;
    }

    router.push("/Dashboard/canvas");
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center">
          <div className="mb-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {greeting}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
              Plan Your Database in Blueprint
            </h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Enter requirements here. Studio will handle generation, scoring,
              and analysis.
            </p>
          </div>

          <div className="w-full rounded-3xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 rounded-2xl border bg-background p-2 sm:p-3">
              <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt(prompt);
                  }
                }}
                placeholder="Describe entities, constraints, and relationships..."
                className="border-0 bg-transparent focus-visible:ring-0"
              />
              <Button
                size="icon"
                onClick={() => submitPrompt(prompt)}
                disabled={!prompt.trim()}
                aria-label="Submit blueprint prompt"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {RECOMMENDATIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPrompt(item)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground sm:text-sm">
                History mode: session only (resets on refresh). This is a safer
                default for now.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessages([])}
                disabled={messages.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          {messages.length > 0 && (
            <div className="mt-6 w-full space-y-3">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl border bg-primary/10 px-4 py-3 text-sm"
                      : "mr-auto max-w-[85%] rounded-2xl border bg-muted px-4 py-3 text-sm"
                  }
                >
                  {message.content}
                </article>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Button onClick={continueToStudio}>Continue in Studio</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
