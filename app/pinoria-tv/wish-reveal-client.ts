import type { ClaimedWishReveal } from "./wish-reveal-types";
import { PINORIA_WISH_REVEAL_URL } from "./wish-reveal-types";

async function post(body: Record<string, unknown>) {
  const response = await fetch(PINORIA_WISH_REVEAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`WISH_REVEAL_HTTP_${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function claimWishReveal(centerId: string): Promise<ClaimedWishReveal | null> {
  const data = await post({ op: "claim", centerId }) as { reveal?: ClaimedWishReveal | null };
  return data.reveal ?? null;
}

export async function completeWishReveal(centerId: string, revealId: string): Promise<void> {
  await post({ op: "complete", centerId, revealId });
}
