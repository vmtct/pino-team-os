import { BoApiError } from "./bo-api-error";
import type {
  BoWebCmsRevision,
  BoWebCmsSite,
  BoWebCmsSlotDetail,
  BoWebCmsSlotSummary,
  BoWebCmsValue,
} from "./bo-web-cms-model";

type Payload<T> = { data?: T; error?: { message?: string; requestId?: string } };

async function readOne<T>(path: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  const body = await response.json() as Payload<T>;
  if (!response.ok || body.data === undefined) throw apiError(response, body, "Website CMS data could not be loaded.");
  return body.data;
}

async function command<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as Payload<T>;
  if (!response.ok || payload.data === undefined) throw apiError(response, payload, "Website CMS command could not be completed.");
  return payload.data;
}
function apiError(response: Response, body: Payload<unknown>, fallback: string) {
  return new BoApiError(
    response.status,
    body.error?.message ?? fallback,
    response.headers.get("x-request-id") ?? body.error?.requestId ?? null,
  );
}

export const boWebCmsApi = {
  slots: (site: BoWebCmsSite, page?: string) => {
    const query = new URLSearchParams({ site });
    if (page) query.set("page", page);
    return readOne<BoWebCmsSlotSummary[]>(`web-cms/slots?${query}`);
  },
  detail: (slotId: string) => readOne<BoWebCmsSlotDetail>(`web-cms/slots/${encodeURIComponent(slotId)}`),
  history: (slotId: string) => readOne<BoWebCmsRevision[]>(`web-cms/slots/${encodeURIComponent(slotId)}/history`),
  saveDraft: (slotId: string, expectedRevision: number, value: BoWebCmsValue, idempotencyKey: string) =>
    command<BoWebCmsRevision>(`web-cms/slots/${encodeURIComponent(slotId)}/draft`, { expectedRevision, value }, idempotencyKey),
  publish: (slotId: string, expectedRevision: number, idempotencyKey: string) =>
    command<BoWebCmsRevision>(`web-cms/slots/${encodeURIComponent(slotId)}/publish`, { expectedRevision }, idempotencyKey),
  rollback: (slotId: string, expectedRevision: number, targetRevisionId: string, idempotencyKey: string) =>
    command<BoWebCmsRevision>(`web-cms/slots/${encodeURIComponent(slotId)}/rollback`, { expectedRevision, targetRevisionId }, idempotencyKey),
};
