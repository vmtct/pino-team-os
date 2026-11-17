/** PAP-1385 / Epic PAP-650 PNR-TV. Founder HO visibility UI: Core is the only truth. */
export type TvVisibilityScope = "DEFAULT" | "CENTER";
export type TvVisibilityCenter = Readonly<{ id: string; name: string }>;
export type TvLiveVisibility = Readonly<{
  id: string;
  originCenterId: string | null;
  name: string;
  scope: TvVisibilityScope;
  assignedCenterIds: string[];
  revision: number;
  createdAt: string | null;
  createdByUserId: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
}>;
export type TvVisibilityDraft = Readonly<{
  name: string;
  scope: TvVisibilityScope;
  assignedCenterIds: string[];
}>;
export type TvVisibilityErrorCode =
  | "LOGIN" | "DENIED" | "MISSING" | "CONFLICT" | "INVALID" | "UNAVAILABLE" | "VERIFY";
export class TvVisibilityClientError extends Error {
  constructor(readonly code: TvVisibilityErrorCode, readonly status: number = 0) {
    super(code);
    this.name = "TvVisibilityClientError";
  }
}
type Requester = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const policyRegex = /^tvp1-(?:default|center-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const invalid = (): never => { throw new TvVisibilityClientError("INVALID"); };
const isStamp = (v: unknown): v is string | null => v === null || (typeof v === "string" && v.length > 0);
const isActor = (v: unknown): v is string | null => v === null || (typeof v === "string" && uuid.test(v));
export function selectedTvCenter(policyRef: string, centers: readonly TvVisibilityCenter[]): string | null {
  if (!policyRegex.test(policyRef)) return null;
  const origin = policyRef.startsWith("tvp1-center-") ? policyRef.slice("tvp1-center-".length) : null;
  const selected = origin ?? centers[0]?.id;
  return selected && uuid.test(selected) && centers.some(c => c.id === selected) ? selected : null;
}
export function parseTvVisibility(
  envelope: unknown, policyRef: string, centers: readonly TvVisibilityCenter[],
): TvLiveVisibility {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return invalid();
  const data = (envelope as Record<string, unknown>).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return invalid();
  const v = data as Record<string, unknown>;
  const origin = policyRef.startsWith("tvp1-center-") ? policyRef.slice("tvp1-center-".length) : null;
  if (!policyRegex.test(policyRef) || v.id !== policyRef || v.originCenterId !== origin ||
      typeof v.name !== "string" || v.name.trim() !== v.name ||
      v.name.length < 1 || v.name.length > 200 ||
      (v.scope !== "DEFAULT" && v.scope !== "CENTER") ||
      !Array.isArray(v.assignedCenterIds) || v.assignedCenterIds.length > 100 ||
      !v.assignedCenterIds.every((id: unknown) => typeof id === "string" && uuid.test(id) &&
        centers.some(c => c.id === id)) ||
      new Set(v.assignedCenterIds).size !== v.assignedCenterIds.length ||
      (v.scope === "DEFAULT" && v.assignedCenterIds.length !== 0) ||
      !Number.isSafeInteger(v.revision) || (v.revision as number) < 0 ||
      !isStamp(v.createdAt) || !isStamp(v.updatedAt) ||
      !isActor(v.createdByUserId) || !isActor(v.updatedByUserId)) return invalid();
  return v as TvLiveVisibility;
}
function route(policyRef: string): string {
  if (!policyRegex.test(policyRef)) return invalid();
  return "/api/ho/pinoria/tv-policies/visibility/" + policyRef;
}
async function checkedResponse(response: Response): Promise<unknown> {
  if (response.status === 401) throw new TvVisibilityClientError("LOGIN", 401);
  if (response.status === 403) throw new TvVisibilityClientError("DENIED", 403);
  if (response.status === 404) throw new TvVisibilityClientError("MISSING", 404);
  if (response.status === 409) throw new TvVisibilityClientError("CONFLICT", 409);
  if (response.status === 400) throw new TvVisibilityClientError("INVALID", 400);
  if (!response.ok) throw new TvVisibilityClientError("UNAVAILABLE", response.status);
  try { return await response.json() as unknown; }
  catch { throw new TvVisibilityClientError("UNAVAILABLE", response.status); }
}
export async function readTvVisibility(
  policyRef: string,
  selectedCenterId: string,
  centers: readonly TvVisibilityCenter[],
  requester: Requester = fetch,
  signal?: AbortSignal,
): Promise<TvLiveVisibility> {
  if (!uuid.test(selectedCenterId) || !centers.some(c => c.id === selectedCenterId)) return invalid();
  const response = await requester(route(policyRef) + "?selectedCenterId=" + selectedCenterId, {
    method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
  });
  return parseTvVisibility(await checkedResponse(response), policyRef, centers);
}
export function makeTvVisibilityDraft(
  current: TvLiveVisibility, draft: TvVisibilityDraft, centers: readonly TvVisibilityCenter[],
): TvVisibilityDraft & { expectedRevision: number } {
  if (typeof draft.name !== "string" || draft.name !== draft.name.trim() ||
      draft.name.length < 1 || draft.name.length > 200 ||
      (draft.scope !== "DEFAULT" && draft.scope !== "CENTER") ||
      !Array.isArray(draft.assignedCenterIds) || draft.assignedCenterIds.length > 100 ||
      draft.assignedCenterIds.some(id => !uuid.test(id) || !centers.some(c => c.id === id)) ||
      new Set(draft.assignedCenterIds).size !== draft.assignedCenterIds.length ||
      (draft.scope === "DEFAULT" && draft.assignedCenterIds.length > 0)) return invalid();
  return {
    name: draft.name, scope: draft.scope, assignedCenterIds: [...draft.assignedCenterIds],
    expectedRevision: current.revision,
  };
}
export async function saveTvVisibility(
  current: TvLiveVisibility,
  selectedCenterId: string,
  draft: TvVisibilityDraft,
  centers: readonly TvVisibilityCenter[],
  requester: Requester = fetch,
  signal?: AbortSignal,
): Promise<TvLiveVisibility> {
  if (!uuid.test(selectedCenterId) || !centers.some(c => c.id === selectedCenterId)) return invalid();
  const body = makeTvVisibilityDraft(current, draft, centers);
  if (body.name === current.name && body.scope === current.scope &&
      JSON.stringify(body.assignedCenterIds) === JSON.stringify(current.assignedCenterIds)) return current;
  const response = await requester(route(current.id), {
    method: "PATCH", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedCenterId, ...body }), signal,
  });
  const saved = parseTvVisibility(await checkedResponse(response), current.id, centers);
  if (saved.revision !== current.revision + 1 ||
      saved.name !== draft.name || saved.scope !== draft.scope ||
      JSON.stringify(saved.assignedCenterIds) !== JSON.stringify(draft.assignedCenterIds))
    throw new TvVisibilityClientError("VERIFY", 200);
  const confirmed = await readTvVisibility(current.id, selectedCenterId, centers, requester, signal);
  if (confirmed.revision !== saved.revision || confirmed.name !== saved.name ||
      confirmed.scope !== saved.scope ||
      JSON.stringify(confirmed.assignedCenterIds) !== JSON.stringify(saved.assignedCenterIds) ||
      confirmed.updatedAt !== saved.updatedAt ||
      confirmed.updatedByUserId !== saved.updatedByUserId)
    throw new TvVisibilityClientError("VERIFY", 200);
  return confirmed;
}
