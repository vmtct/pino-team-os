const CANONICAL_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Minimize authenticated runtime RPC response; never leak projection or queued events. */
export function projectTvRuntimeStatus(value: unknown): { ok: true; activePresentationId: string | null } {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("data" in value)) {
    throw new Error("TV runtime status unavailable");
  }
  const data = value.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || !("activePresentationId" in data)) {
    throw new Error("TV runtime status unavailable");
  }
  const active = data.activePresentationId;
  if (active !== null && (typeof active !== "string" || !CANONICAL_ID.test(active))) {
    throw new Error("TV runtime status unavailable");
  }
  return { ok: true, activePresentationId: active };
}
