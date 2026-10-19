/**
 * PAP-665 authenticated operator boundary. This is intentionally separate
 * from the public/TV presentation relay: Core's TOS control plane enforces
 * the operator principal, Center ACL, audit and durable command receipts.
 * Calling this client never grants authority on its own.
 */
export type OperatorQueue = {
  current: { id: string; kind: string; claimedAt: string; projection: Record<string, unknown> } | null;
  queued: readonly { id: string; kind: string }[];
  hasMore: boolean;
  revision: number;
};

export class OperatorPresentationError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function operatorRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/tos-learning/pinoria/presentations/${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json() as { data?: T; error?: { code?: string; message?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new OperatorPresentationError(
      response.status,
      payload.error?.code ?? "OPERATOR_PRESENTATION_UNAVAILABLE",
      payload.error?.message ?? "Cannot load operator presentation",
    );
  }
  return payload.data;
}

export const operatorPresentationClient = {
  queue: (centerId: string) =>
    operatorRequest<OperatorQueue>(`queue?centerId=${encodeURIComponent(centerId)}`),
  // An authenticated snapshot lookup, not a dispatch/replay of business events.
  replaySnapshotInspect: (centerId: string, presentationId: string) =>
    operatorRequest<{ id: string; kind: string; projection: Record<string, unknown>; claimedAt: string }>(
      "replay-snapshot",
      { method: "POST", body: JSON.stringify({ centerId, presentationId }) },
    ),
  close: (centerId: string, presentationId: string, expectedClaimedAt: string, idempotencyKey: string) => {
    if (!expectedClaimedAt.trim() || !idempotencyKey.trim()) {
      throw new Error("Operator close requires claim token and idempotency key");
    }
    return operatorRequest<{ presentationId: string; completedAt: string }>(
      "close",
      {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey },
        body: JSON.stringify({ centerId, presentationId, expectedClaimedAt }),
      },
    );
  },
};
