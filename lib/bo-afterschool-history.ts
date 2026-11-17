// PAP-1886 / PNR-IDENTITY — exact redacted Afterschool History read contract, no generic audit widening.
const canonical = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const opaque = /^[A-Za-z0-9_-]{1,2048}$/;
export type AfterschoolHistoryEvent = {
  id: string; subject_type: "parent_pin_credential"; subject_id: string; occurred_at: string;
  actor_id: null; actor_label: "Nhân viên" | "Hệ thống"; action: "Cấp PIN" | "Cấp lại PIN";
  outcome: "succeeded"; field: null; before: null; after: null; description: null; redacted: true;
};
export type AfterschoolHistoryPage = {events: AfterschoolHistoryEvent[]; nextCursor: string | null};
const keys = ["id","subject_type","subject_id","occurred_at","actor_id","actor_label","action","outcome","field","before","after","description","redacted"];
function invalid(): never { throw new Error("Không xác minh được lịch sử tài khoản."); }
function exact(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const x = value as Record<string, unknown>;
  if (Object.keys(x).length !== fields.length || fields.some(k=>!Object.hasOwn(x,k))) invalid();
  return x;
}
export function afterschoolHistoryPath(parentId: string, centerId: string, cursor?: string | null, limit=25): string {
  if (!canonical.test(parentId) || !canonical.test(centerId) || !Number.isSafeInteger(limit) || limit<1 || limit>50 ||
    (cursor != null && !opaque.test(cursor))) invalid();
  const query = new URLSearchParams({centerId,limit:String(limit)});
  if (cursor) query.set("cursor",cursor);
  return "/api/bo/identity/afterschool-users/"+parentId+"/history?"+query;
}
// Center is enforced in the authenticated server transport; the DTO deliberately has no raw provenance.
export function validateAfterschoolHistoryPage(value: unknown, parentId: string, previous: readonly AfterschoolHistoryEvent[]=[],
  priorCursor?: string | null, limit=25): AfterschoolHistoryPage {
  if (!canonical.test(parentId) || !Number.isSafeInteger(limit) || limit<1 || limit>50) invalid();
  const page=exact(value,["events","nextCursor"]);
  if (!Array.isArray(page.events) || page.events.length>limit ||
    !(page.nextCursor===null || (typeof page.nextCursor==="string" && opaque.test(page.nextCursor))) ||
    (priorCursor && page.nextCursor===priorCursor) || (page.events.length!==limit && page.nextCursor!==null)) invalid();
  const seen=new Set(previous.map(e=>e.id));
  let last=previous.at(-1);
  const events: AfterschoolHistoryEvent[]=[];
  for (const item of page.events as unknown[]) {
    const e=exact(item,keys);
    if (typeof e.id!=="string" || !canonical.test(e.id) || seen.has(e.id) ||
      e.subject_type!=="parent_pin_credential" || e.subject_id!==parentId ||
      typeof e.occurred_at!=="string" || !Number.isFinite(Date.parse(e.occurred_at)) || new Date(e.occurred_at).toISOString()!==e.occurred_at ||
      (e.actor_label!=="Nhân viên" && e.actor_label!=="Hệ thống") || (e.action!=="Cấp PIN" && e.action!=="Cấp lại PIN") ||
      e.outcome!=="succeeded" || e.redacted!==true || e.actor_id!==null || e.field!==null || e.before!==null || e.after!==null || e.description!==null) invalid();
    if (last && (e.occurred_at>last.occurred_at || (e.occurred_at===last.occurred_at && e.id>=last.id))) invalid();
    const row: AfterschoolHistoryEvent={id:e.id,subject_type:"parent_pin_credential",subject_id:parentId,occurred_at:e.occurred_at,
      actor_id:null,actor_label:e.actor_label,action:e.action,outcome:"succeeded",field:null,before:null,after:null,description:null,redacted:true};
    seen.add(row.id); events.push(row); last=row;
  }
  return {events,nextCursor:page.nextCursor};
}

// PAP-1886: narrow selected-Center History read, never a generic audit route.
export const AFTERSCHOOL_HISTORY_READ = /^identity\/afterschool-users\/([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/history$/;
export function afterschoolHistoryCoreRequest(path: string, url: URL) {
  const match=AFTERSCHOOL_HISTORY_READ.exec(path);
  const params=url.searchParams;
  if (!match || [...params.keys()].some(k=>!["centerId","cursor","limit"].includes(k)||params.getAll(k).length!==1))
    throw new RangeError("Invalid History query");
  const centerId=params.get("centerId"), limit=params.get("limit"), cursor=params.get("cursor");
  if (!centerId || !canonical.test(centerId) || (limit!==null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit)) ||
      (cursor!==null && !opaque.test(cursor))) throw new RangeError("Invalid History scope");
  const paging=new URLSearchParams();
  if(limit!==null) paging.set("limit",limit);
  if(cursor!==null) paging.set("cursor",cursor);
  return { request:{method:"GET" as const,path:path+(paging.size?"?"+paging.toString():""),resource:{centerId}},parentId:match[1]!,limit:limit===null?25:Number(limit),cursor };
}
