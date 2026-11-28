/** PAP-2425 / MISSION-ASSIGNMENT: unmounted staging review admission.
 * Caller must first use the existing server-owned BO shell/preview admission.
 * No synthetic authorization, live command transport, or local sandbox changes.
 */
import { surfaceSession, type CenterSource } from "@/lib/workspace-adapters/session";
import { assignmentUuid, parseMissionAssignment } from "@/lib/bo-mission-assignments";
import { ASSIGNMENT_M1_ID, ASSIGNMENT_M1_ROUTE } from "./assignment-m1-fixture";
const origin = "https://bo.staging.pinohouse.art";
const read = "student.mission_assignment.view";
const manage = "student.mission_assignment.manage";
export function parseAssignmentStageReview(url: URL) {
  const q = url.searchParams;
  const centerId = q.get("centerId"), record = q.get("record"), surface = q.get("surface"), tab = q.get("tab");
  if (url.origin !== origin || url.pathname !== ASSIGNMENT_M1_ROUTE || url.username || url.password || url.hash ||
      [...q.keys()].some(k => !["centerId","record","surface","tab"].includes(k) || q.getAll(k).length !== 1) ||
      !centerId || !assignmentUuid.test(centerId) ||
      (record !== null && record !== ASSIGNMENT_M1_ID) ||
      (surface !== null && (surface !== "detail" || record !== ASSIGNMENT_M1_ID)) ||
      (tab !== null && (surface !== "detail" || !["overview","history"].includes(tab)))) return null;
  return { centerId, recordId: record, kind: surface === "detail" ? "detail" : record ? "drawer" : "table", tab: tab ?? "overview" } as const;
}
/** Read-only proof, not a live manage grant. The returned object contains no real rows.
 * The exact principal must be supplied from the canonical server gate, not URL/storage.
 */
export async function verifyAssignmentStageReview(input: {url: URL; expectedActorId: string; centerSource: CenterSource; signal: AbortSignal; fetcher?: typeof fetch}) {
  const route = parseAssignmentStageReview(input.url);
  if (!route || !input.expectedActorId.trim()) throw Error("Mission review admission denied");
  const session = surfaceSession("BO", origin, input.fetcher, {id: route.centerId, source: input.centerSource});
  try {
    const check = async () => {
      const principal = await session.refresh(input.signal);
      if (principal.userId !== input.expectedActorId || !session.context.authorize(read) || !session.context.authorize(manage)) throw Error("Mission review admission denied");
    };
    await check();
    const proof = await session.transport("/api/bo/learning/mission-assignments?" + new URLSearchParams({centerId:route.centerId,limit:"1",offset:"0"}), {method:"GET", signal:input.signal});
    if (!proof.ok) throw Error("Mission review scope denied");
    const body: unknown = await proof.json();
    if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data) || body.data.length > 1) throw Error("Mission review scope unverified");
    for (const row of body.data) parseMissionAssignment(row, route.centerId);
    await check();
    return Object.freeze({actorId: input.expectedActorId, centerId: route.centerId, route});
  } finally { session.dispose(); }
}
