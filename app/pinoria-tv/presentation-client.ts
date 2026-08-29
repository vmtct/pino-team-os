import type { PinoriaPresentation } from "./presentation-types";

type Envelope = {
  presentation?: PinoriaPresentation | null;
  ok?: boolean;
  error?: string | { message?: string };
};

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/pinoria-tv/presentation", {
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

export async function claimPresentation(centerId: string) {
  const json = await post({ op: "claim", centerId });
  return json.presentation ?? null;
}

export async function completePresentation(centerId: string, presentationId: string) {
  await post({ op: "complete", centerId, presentationId });
}
