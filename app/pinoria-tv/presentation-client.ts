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
  return json.presentation ?? null;
}

export async function completePresentation(centerId: string, presentationId: string, apiBase?: string) {
  await post({ op: "complete", centerId, presentationId }, apiBase);
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
       (typeof payload.activePresentationId !== "string" || !payload.activePresentationId))) {
    throw new Error("Pinoria TV presentation status unavailable");
  }
  return payload.activePresentationId as string | null;
}