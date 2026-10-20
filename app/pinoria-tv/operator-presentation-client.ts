import { parseOperatorQueue, parseOperatorSnapshot } from "./operator-queue-validate";

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

export type OperatorHealth = {centerId:string;queueRevision:number;activePresentation:{id:string;kind:string;claimedAt:string}|null;queuedCount:number;hasMore:boolean;runtimeConnectivity:null;buildIdentity:null;appliedConfigVersion:null;assetHealth:null;rendererAcknowledged:boolean};
export const operatorPresentationClient = {
  operatorHealth: (centerId:string) => operatorRequest<OperatorHealth>(`operator-health?centerId=${encodeURIComponent(centerId)}`),
  queue: async (centerId: string) =>
    parseOperatorQueue(await operatorRequest<unknown>(`queue?centerId=${encodeURIComponent(centerId)}`)),
  // View-only inspection. Core authorizes pinoria.presentation.view and audits the read.
  inspectSnapshot: async (centerId: string, presentationId: string) =>
    parseOperatorSnapshot(await operatorRequest<unknown>(
      "snapshot?centerId=" + encodeURIComponent(centerId) + "&presentationId=" + encodeURIComponent(presentationId),
    )),
  // An authenticated snapshot lookup, not a dispatch/replay of business events.
  replaySnapshotInspect: async (centerId: string, presentationId: string) =>
    parseOperatorSnapshot(await operatorRequest<unknown>(
      "replay-snapshot",
      { method: "POST", body: JSON.stringify({ centerId, presentationId }) },
    )),
  // Physical replay is an explicit control command, not snapshot inspection.
  replayTarget: (centerId: string, displayId: string, presentationId: string) =>
    operatorRequest<{ available: boolean; target: { displayId: string; deviceId: string } | null }>(
      `replay-target?centerId=${encodeURIComponent(centerId)}&displayId=${encodeURIComponent(displayId)}&presentationId=${encodeURIComponent(presentationId)}`,
    ),
  replayDispatch: (centerId: string, displayId: string, presentationId: string, idempotencyKey: string) => {
    if (!idempotencyKey.trim()) throw new Error("Replay dispatch requires idempotency key");
    return operatorRequest<unknown>("replay-dispatch", {
      method: "POST", headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify({ centerId, displayId, presentationId }),
    });
  },  returnToAmbient: (centerId: string, presentationId: string, expectedClaimedAt: string, idempotencyKey: string) => completeOperatorPresentation("return-to-ambient", centerId, presentationId, expectedClaimedAt, idempotencyKey),
  close: (centerId: string, presentationId: string, expectedClaimedAt: string, idempotencyKey: string) => completeOperatorPresentation("close", centerId, presentationId, expectedClaimedAt, idempotencyKey),
};
function completeOperatorPresentation(action: "close" | "return-to-ambient", centerId: string, presentationId: string, expectedClaimedAt: string, idempotencyKey: string) {
    if (!expectedClaimedAt.trim() || !idempotencyKey.trim()) {
      throw new Error("Operator close requires claim token and idempotency key");
    }
    return operatorRequest<{ presentationId: string; completedAt: string }>(
      action,
      {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey },
        body: JSON.stringify({ centerId, presentationId, expectedClaimedAt }),
      },
    );
}
