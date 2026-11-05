import { BoApiError } from "./bo-api-error";

/** PAP-1210 consumes PAP-1208. Assignment is independent of Result and Diary. */
export const assignmentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MissionAssignment = {
  id: string; centerId: string; studentId: string; missionId: string;
  missionCodeSnapshot: string; missionNameSnapshot: string;
  contextKey: string; contextLabel: string | null; status: "ASSIGNED" | "CANCELLED";
  assignedAt: string; assignedByUserId: string; updatedAt: string; updatedByUserId: string;
  cancelledAt: string | null; cancelledReason: string | null; version: number;
};
const invalid = () => new BoApiError(502, "Phản hồi Nhiệm vụ không hợp lệ hoặc khác Center.", null);
const text = (v: unknown, max: number, empty = false): v is string => typeof v === "string" && (empty || !!v.trim()) && v.length <= max;
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
export function parseMissionAssignment(value: unknown, centerId: string, expectedId?: string): MissionAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const p = value as Record<string, unknown>;
  if (!assignmentUuid.test(centerId) || ![p.id, p.centerId, p.studentId, p.missionId, p.assignedByUserId, p.updatedByUserId].every(v => typeof v === "string" && assignmentUuid.test(v)) ||
      p.centerId !== centerId || (expectedId !== undefined && p.id !== expectedId) ||
      !text(p.missionCodeSnapshot, 200) || !text(p.missionNameSnapshot, 500) || !text(p.contextKey, 120, true) ||
      !(p.contextLabel === null || text(p.contextLabel, 200)) || !["ASSIGNED", "CANCELLED"].includes(String(p.status)) ||
      !timestamp(p.assignedAt) || !timestamp(p.updatedAt) || !Number.isSafeInteger(p.version) || Number(p.version) < 1 ||
      !(p.cancelledAt === null || timestamp(p.cancelledAt)) || !(p.cancelledReason === null || text(p.cancelledReason, 500)) ||
      (p.status === "ASSIGNED" ? p.cancelledAt !== null || p.cancelledReason !== null : p.cancelledAt === null || p.cancelledReason === null)) throw invalid();
  // Explicit projection: unexpected/private Core properties never enter the renderer.
  return Object.fromEntries(["id", "centerId", "studentId", "missionId", "missionCodeSnapshot", "missionNameSnapshot", "contextKey", "contextLabel", "status", "assignedAt", "assignedByUserId", "updatedAt", "updatedByUserId", "cancelledAt", "cancelledReason", "version"].map(k => [k, p[k]])) as MissionAssignment;
}
async function read(fetcher: typeof fetch, path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetcher("/api/bo/learning/mission-assignments" + path, { method: "GET", cache: "no-store", signal });
  signal.throwIfAborted();
  if (!response.ok) throw new BoApiError(response.status, "Không thể đọc Nhiệm vụ tại Center này.", response.headers.get("x-request-id"));
  let body: unknown;
  try { body = await response.json(); } catch { throw invalid(); }
  signal.throwIfAborted();
  if (!body || typeof body !== "object" || !("data" in body)) throw invalid();
  return body.data;
}
/** No total in C1 API: collect complete bounded pages before local TDD search/sort.
 * Exceeding the bound fails visibly; never show a truncated list as a complete count. */
export async function readMissionAssignments(fetcher: typeof fetch, centerId: string, signal: AbortSignal): Promise<readonly MissionAssignment[]> {
  if (!assignmentUuid.test(centerId)) throw invalid();
  const rows: MissionAssignment[] = [], seen = new Set<string>();
  for (let page = 0; page <= 100; page++) {
    const data = await read(fetcher, "?" + new URLSearchParams({ centerId, limit: "100", offset: String(page * 100) }), signal);
    if (!Array.isArray(data) || data.length > 100 || rows.length + data.length > 10000) throw invalid();
    for (const value of data) {
      const row = parseMissionAssignment(value, centerId);
      if (seen.has(row.id)) throw invalid();
      seen.add(row.id); rows.push(row);
    }
    if (data.length < 100) return rows;
  }
  throw invalid();
}
export async function readMissionAssignment(fetcher: typeof fetch, centerId: string, id: string, signal: AbortSignal): Promise<MissionAssignment | null> {
  if (!assignmentUuid.test(centerId) || !assignmentUuid.test(id)) throw invalid();
  try { return parseMissionAssignment(await read(fetcher, "/" + encodeURIComponent(id) + "?" + new URLSearchParams({ centerId }), signal), centerId, id); }
  catch (error) { if (error instanceof BoApiError && error.status === 404) return null; throw error; }
}


/** PAP-1193/PAP-1209: Only Core's explicit authorized assignment->Diary projection. */
export type LinkedMissionDiary = {
 linkId: string; diaryId: string; linkedAt: string; registeredAt: string | null;
 studentId: string; teachingContextKey: string; runningClassId: string | null;
 status: "REGISTERED" | "CLOSED"; registeredByUserId: string | null;
};
export type LinkedMissionDiaryPage = {
 assignmentId: string; diaries: LinkedMissionDiary[];
 limit: number; offset: number; hasMore: boolean;
};
const linkedInvalid = () => new BoApiError(502, "Nguồn Nhật Ký liên kết không hợp lệ.", null);
const object = (value: unknown): Record<string, unknown> => {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw linkedInvalid();
 return value as Record<string, unknown>;
};
const iso = (value: unknown): value is string =>
 typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export function parseLinkedMissionDiaryPage(value: unknown, centerId: string, assignmentId: string): LinkedMissionDiaryPage {
 const p = object(value);
 if (!assignmentUuid.test(centerId) || !assignmentUuid.test(assignmentId) || p.assignmentId !== assignmentId ||
  !Number.isSafeInteger(p.limit) || Number(p.limit) < 1 || Number(p.limit) > 100 ||
  !Number.isSafeInteger(p.offset) || Number(p.offset) < 0 || p.offset as number > 10000 ||
  typeof p.hasMore !== "boolean" || !Array.isArray(p.diaries) || p.diaries.length > Number(p.limit)) throw linkedInvalid();
 const seen = new Set<string>();
 const diaries = p.diaries.map(item => {
  const r = object(item), x = object(r.diary);
  if (![r.linkId, r.diaryId, x.studentId].every(v => typeof v === "string" && assignmentUuid.test(v)) ||
   !iso(r.linkedAt) || x.id !== r.diaryId || x.centerId !== centerId ||
   !["REGISTERED", "CLOSED"].includes(String(x.status)) ||
   typeof x.teachingContextKey !== "string" || x.teachingContextKey.length > 200 ||
   !(x.runningClassId == null || typeof x.runningClassId === "string" && assignmentUuid.test(x.runningClassId)) ||
   !(x.registeredAt == null || iso(x.registeredAt)) ||
   !(x.registeredByUserId == null || typeof x.registeredByUserId === "string" && assignmentUuid.test(x.registeredByUserId)) ||
   seen.has(String(r.diaryId))) throw linkedInvalid();
  seen.add(String(r.diaryId));
  return {linkId:r.linkId as string, diaryId:r.diaryId as string, linkedAt:r.linkedAt as string,
   registeredAt:(x.registeredAt as string|null)??null, studentId:x.studentId as string,
   teachingContextKey:x.teachingContextKey as string, runningClassId:(x.runningClassId as string|null)??null,
   status:x.status as "REGISTERED"|"CLOSED", registeredByUserId:(x.registeredByUserId as string|null)??null};
 });
 return {assignmentId,diaries,limit:p.limit as number,offset:p.offset as number,hasMore:p.hasMore as boolean};
}
export async function readMissionLinkedDiaries(fetcher:typeof fetch,centerId:string,assignmentId:string,signal:AbortSignal):Promise<LinkedMissionDiary[]> {
 if (!assignmentUuid.test(centerId)||!assignmentUuid.test(assignmentId))throw linkedInvalid();
 const all:LinkedMissionDiary[]=[];const ids=new Set<string>();
 for(let offset=0;offset<=10000;offset+=100) {
  const query=new URLSearchParams({centerId,limit:"100",offset:String(offset)});
  const response=await fetcher("/api/bo/learning/mission-assignments/"+encodeURIComponent(assignmentId)+"/diaries?"+query,
   {method:"GET",cache:"no-store",signal});
  signal.throwIfAborted();
  if(!response.ok)throw new BoApiError(response.status,"Không đọc được Nhật Ký liên kết.",response.headers.get("x-request-id"));
  let data:unknown;try{data=(await response.json() as {data:unknown}).data}catch{throw linkedInvalid()}
  signal.throwIfAborted();
  const page=parseLinkedMissionDiaryPage(data,centerId,assignmentId);
  if(page.limit!==100||page.offset!==offset)throw linkedInvalid();
  for(const row of page.diaries) {if(ids.has(row.diaryId))throw linkedInvalid();ids.add(row.diaryId);all.push(row);}
  if(!page.hasMore)return all;
  if(page.diaries.length===0&&offset===10000)throw linkedInvalid();
 }
 throw linkedInvalid(); // bounded; never misreport truncated data as complete.
}
