const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reduce a privileged Core inspect response to TV-safe metadata, failing closed on corruption. */
export function tvActiveStatusProjection(value: unknown): { ok: true; activePresentationId: string | null } {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("current" in value)) {
    throw new Error("Pinoria TV active status shape invalid");
  }
  const current = value.current;
  if (current === null) return { ok: true, activePresentationId: null };
  if (typeof current !== "object" || current === null || Array.isArray(current) ||
      !("id" in current) || typeof current.id !== "string" || !UUID.test(current.id)) {
    throw new Error("Pinoria TV active presentation invalid");
  }
  return { ok: true, activePresentationId: current.id };
}
