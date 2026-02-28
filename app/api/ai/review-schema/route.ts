import { NextRequest, NextResponse } from "next/server";
import { reviewSchema, isAIAvailable } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schema } = body;

    if (!schema) {
      return NextResponse.json(
        { error: "Missing 'schema' field" },
        { status: 400 },
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY not configured", fallback: true },
        { status: 503 },
      );
    }

    const result = await reviewSchema(schema);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to parse AI response", fallback: true },
        { status: 500 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("review-schema error:", error);
    return NextResponse.json(
      { error: "Internal server error", fallback: true },
      { status: 500 },
    );
  }
}
