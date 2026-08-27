import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_PATH = path.join(process.cwd(), "app", "pinoria-tv", "ambient-dialogues.saved.json");

type Exchange = { first: string; reply: string };

type DialogueConfig = {
  version: number;
  maxConcurrentBubbles: number;
  conversationDurationMs: number;
  exchanges: Exchange[];
};

function isValidConfig(value: unknown): value is DialogueConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<DialogueConfig>;
  return config.version === 1
    && Number.isInteger(config.maxConcurrentBubbles)
    && Number(config.maxConcurrentBubbles) >= 1
    && Number(config.maxConcurrentBubbles) <= 3
    && typeof config.conversationDurationMs === "number"
    && config.conversationDurationMs >= 1500
    && config.conversationDurationMs <= 12000
    && Array.isArray(config.exchanges)
    && config.exchanges.length >= 1
    && config.exchanges.length <= 30
    && config.exchanges.every((item) => Boolean(item)
      && typeof item.first === "string"
      && item.first.trim().length > 0
      && item.first.length <= 140
      && typeof item.reply === "string"
      && item.reply.trim().length > 0
      && item.reply.length <= 140);
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "LOCAL_DEV_ONLY" }, { status: 403 });
  }

  let config: unknown;
  try {
    config = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isValidConfig(config)) {
    return NextResponse.json({ ok: false, error: "INVALID_DIALOGUE_CONFIG" }, { status: 400 });
  }

  await writeFile(TARGET_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return NextResponse.json({ ok: true, path: "app/pinoria-tv/ambient-dialogues.saved.json" });
}
