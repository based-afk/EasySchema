import { NextRequest, NextResponse } from "next/server";
import { tmpdir } from "os";
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { normalizePrompt } from "@/lib/utils/promptNormalizer";

const execFileAsync = promisify(execFile);

function sanitizeTranscript(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\bdata base\b/gi, "database"],
    [/\bpost gress\b/gi, "postgres"],
    [/\bpostgre s\b/gi, "postgres"],
    [/\bschema\s+designer\b/gi, "schema designer"],
  ];

  let cleaned = text.trim();
  for (const [pattern, value] of replacements) {
    cleaned = cleaned.replace(pattern, value);
  }
  cleaned = cleaned.replace(/\s+/g, " ");
  return cleaned;
}

async function runWhisperCpp(inputPath: string): Promise<string> {
  const bin = process.env.WHISPER_CPP_BIN;
  const model = process.env.WHISPER_CPP_MODEL;

  if (!bin || !model) {
    throw new Error(
      "Whisper.cpp is not configured. Set WHISPER_CPP_BIN and WHISPER_CPP_MODEL.",
    );
  }

  const baseName = `whisper-${Date.now()}`;
  const outputBase = path.join(tmpdir(), baseName);

  await execFileAsync(bin, [
    "-m",
    model,
    "-f",
    inputPath,
    "-otxt",
    "-of",
    outputBase,
  ]);

  const outputPath = `${outputBase}.txt`;
  const text = await fs.readFile(outputPath, "utf-8");
  await fs.unlink(outputPath).catch(() => null);
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing audio file" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const inputPath = path.join(tmpdir(), `upload-${Date.now()}.webm`);
    await fs.writeFile(inputPath, buffer);

    const rawText = await runWhisperCpp(inputPath);
    await fs.unlink(inputPath).catch(() => null);

    const cleaned = sanitizeTranscript(rawText);
    const normalized = normalizePrompt(cleaned);

    return NextResponse.json({
      text: cleaned,
      normalized,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
