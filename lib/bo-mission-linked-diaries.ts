import { BoApiError } from "./bo-api-error";
import { assignmentUuid } from "./bo-mission-assignments";

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
const invalid = () => new BoApiError(502, "Nguồn Nhật Ký liên kết không hợp lệ.", null);
const object = (value: unknown): Record<string, unknown> => {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
 return value as Record<string, unknown>;
};
const iso = (value: unknown): value is string =>
 typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export function parseLinkedMissionDiaryPage(value: unknown, centerId: string, assignmentId: string): LinkedMissionDiaryPage {
 const p = object(value);
 if (!assignmentUuid.test(centerId) || !assignmentUuid.test(assignmentId) || p.assignmentId !== assignmentId ||
  !Number.isSafeInteger(p.limit) || Number(p.limit) < 1 || Number(p.limit) > 100 ||
  !Number.isSafeInteger(p.offset) || Number(p.offset) < 0 || p.offset as number > 10000 ||
  typeof p.hasMore !== "boolean" || !Array.isArray(p.diaries) || p.diaries.length > Number(p.limit)) throw invalid();
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
   seen.has(String(r.diaryId))) throw invalid();
  seen.add(String(r.diaryId));
  return {linkId:r.linkId as string, diaryId:r.diaryId as string, linkedAt:r.linkedAt as string,
   registeredAt:(x.registeredAt as string|null)??null, studentId:x.studentId as string,
   teachingContextKey:x.teachingContextKey as string, runningClassId:(x.runningClassId as string|null)??null,
   status:x.status as "REGISTERED"|"CLOSED", registeredByUserId:(x.registeredByUserId as string|null)??null};
 });
 return {assignmentId,diaries,limit:p.limit as number,offset:p.offset as number,hasMore:p.hasMore as boolean};
}
export async function readMissionLinkedDiaries(fetcher:typeof fetch,centerId:string,assignmentId:string,signal:AbortSignal):Promise<LinkedMissionDiary[]> {
 if (!assignmentUuid.test(centerId)||!assignmentUuid.test(assignmentId))throw invalid();
 const all:LinkedMissionDiary[]=[];const ids=new Set<string>();
 for(let offset=0;offset<=10000;offset+=100) {
  const query=new URLSearchParams({centerId,limit:"100",offset:String(offset)});
  const response=await fetcher("/api/bo/learning/mission-assignments/"+encodeURIComponent(assignmentId)+"/diaries?"+query,
   {method:"GET",cache:"no-store",signal});
  signal.throwIfAborted();
  if(!response.ok)throw new BoApiError(response.status,"Không đọc được Nhật Ký liên kết.",response.headers.get("x-request-id"));
  let data:unknown;try{data=(await response.json() as {data:unknown}).data}catch{throw invalid()}
  signal.throwIfAborted();
  const page=parseLinkedMissionDiaryPage(data,centerId,assignmentId);
  if(page.limit!==100||page.offset!==offset)throw invalid();
  for(const row of page.diaries) {if(ids.has(row.diaryId))throw invalid();ids.add(row.diaryId);all.push(row);}
  if(!page.hasMore)return all;
  if(page.diaries.length===0&&offset===10000)throw invalid();
 }
 throw invalid(); // bounded; never misreport truncated data as complete.
}
