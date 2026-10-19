import type { PinoriaPresentation } from "./presentation-types";

type Envelope = {
  presentation?: PinoriaPresentation | null;
  ok?: boolean;
  error?: string | { message?: string };
};

async function post(body: Record<string, unknown>, apiBase = "/api/pinoria-tv") {
  const response = await fetch(`${apiBase}/presentation`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json() as Envelope;
  if (!response.ok) {
    const message = typeof json.error === "string" ? json.error : json.error?.message;
    throw new Error(message ?? "Pinoria presentation relay unavailable");
  }
  return json;
}

export async function claimPresentation(centerId: string, apiBase?: string) {
  const json = await post({ op: "claim", centerId }, apiBase);
  const candidate = json.presentation;
  if (candidate === null || candidate === undefined) return null;
  if (!isValidClaimedTvPresentation(candidate)) {
    throw new Error("Pinoria TV claimed presentation invalid");
  }
  return candidate;
}

export async function completePresentation(centerId: string, presentationId: string, apiBase?: string) {
  await post({ op: "complete", centerId, presentationId }, apiBase);
}

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRESENTATION_KINDS = new Set([
  "WISH_REVEAL", "EGG_HATCH", "COMPANION_RITUAL", "ONBOARDING_CEREMONY",
]);
export function isValidClaimedTvPresentation(value: unknown): value is PinoriaPresentation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && CANONICAL_UUID.test(item.id) &&
    typeof item.kind === "string" && PRESENTATION_KINDS.has(item.kind) &&
    typeof item.claimedAt === "string" && item.claimedAt.trim().length > 0 &&
    !!item.projection && typeof item.projection === "object" && !Array.isArray(item.projection);
}
/** Only a canonical release/other-active response can change the displayed TV scene. */
export function shouldReleaseTvScene(displayedId: string, activeId: string | null): boolean {
  return CANONICAL_UUID.test(displayedId) && activeId !== displayedId;
}

/** Authenticated TV relay read. Never claims/advances the queue. */
export async function presentationStatus(centerId: string, apiBase = "/api/pinoria-tv"): Promise<string | null> {
  const response = await fetch(apiBase + "/presentation", {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "status", centerId }),
  });
  const payload = await response.json() as { ok?: boolean; activePresentationId?: unknown };
  if (!response.ok || payload.ok !== true ||
      (payload.activePresentationId !== null &&
       (typeof payload.activePresentationId !== "string" || !CANONICAL_UUID.test(payload.activePresentationId)))) {
    throw new Error("Pinoria TV presentation status unavailable");
  }
  return payload.activePresentationId as string | null;
}
/** A late claim may only be displayed in its original Center generation. */
export function isCurrentTvPresentationClaim(
  requestedCenter: string,
  requestedGeneration: number,
  visibleCenter: string,
  currentGeneration: number,
): boolean {
  return requestedCenter === visibleCenter && requestedGeneration === currentGeneration;
}
/** Recover a failed TV completion only from authoritative Core state; never claim again. */
export async function completionAlreadyReleased(
  centerId: string, presentationId: string, apiBase?: string,
): Promise<boolean> {
  const activeId = await presentationStatus(centerId, apiBase);
  return shouldReleaseTvScene(presentationId, activeId);
}