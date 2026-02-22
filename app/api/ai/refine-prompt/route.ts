import { NextRequest, NextResponse } from "next/server";
import { refinePrompt, isAIAvailable } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'prompt' field" },
        { status: 400 },
      );
    }

    if (!isAIAvailable()) {
      // Fallback: local improvement
      const improved = localRefine(prompt);
      return NextResponse.json(improved);
    }

    const result = await refinePrompt(prompt);

    if (!result) {
      const improved = localRefine(prompt);
      return NextResponse.json(improved);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("refine-prompt error:", error);
    return NextResponse.json(localRefine(""));
  }
}

// ─── Local fallback refiner ─────────────────────────────────────────────────

function localRefine(prompt: string): { improved: string; changes: string[] } {
  const lower = prompt.toLowerCase();
  let improved = prompt;
  const changes: string[] = [];

  if (
    !lower.includes("has") &&
    !lower.includes("belongs") &&
    !lower.includes("contains")
  ) {
    improved +=
      " Each entity should have clear ownership and referential relationships.";
    changes.push("Added relationship clarity guidance");
  }

  if (
    !lower.includes("unique") &&
    !lower.includes("required") &&
    !lower.includes("not null")
  ) {
    improved +=
      " Include constraints like unique emails, required fields, and NOT NULL for critical data.";
    changes.push("Added constraint specifications");
  }

  if (
    !lower.includes("timestamp") &&
    !lower.includes("created") &&
    !lower.includes("track")
  ) {
    improved += " Track creation and modification timestamps for all entities.";
    changes.push("Added timestamp tracking");
  }

  if (
    !lower.includes("scale") &&
    !lower.includes("performance") &&
    !lower.includes("million")
  ) {
    improved += " Consider indexing strategies for scalable query performance.";
    changes.push("Added performance considerations");
  }

  if (changes.length === 0) {
    changes.push("Prompt already covers key areas");
  }

  return { improved: improved.trim(), changes };
}
