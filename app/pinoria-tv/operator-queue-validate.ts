import type { OperatorQueue } from "./operator-presentation-client";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function entry(value: unknown): value is { id: string; kind: string } {
  return record(value) && typeof value.id === "string" && !!value.id.trim() &&
    typeof value.kind === "string" && !!value.kind.trim();
}

/** Malformed, ambiguous or duplicated Core projections never reach operator UI. */
export function parseOperatorQueue(value: unknown): OperatorQueue {
  if (!record(value) || !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 || typeof value.hasMore !== "boolean" ||
      !Array.isArray(value.queued) || value.queued.length > 50 ||
      !value.queued.every(entry)) {
    throw new Error("Invalid operator queue snapshot");
  }
  const current = value.current;
  if (current !== null && (!record(current) ||
      !entry(current) || typeof (current as Record<string, unknown>).claimedAt !== "string" || !((current as Record<string, unknown>).claimedAt as string).trim() ||
      !record((current as Record<string, unknown>).projection))) {
    throw new Error("Invalid operator active presentation");
  }
  const ids = value.queued.map((item: { id: string }) => item.id);
  if (new Set(ids).size !== ids.length ||
      (record(current) && ids.includes(current.id as string))) {
    throw new Error("Ambiguous operator queue snapshot");
  }
  return value as OperatorQueue;
}
