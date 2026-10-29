import { BoApiError } from "@/lib/bo-api-error";
import type { ModuleRow, TableQuery } from "@/lib/workspace-schema";
import type { SurfaceProvider } from "@/lib/workspace-adapters";
import { readData } from "@/lib/workspace-adapters/providers";
import type { SelfFields } from "./schema";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rowId = /^(PERSON|STAFF|LEARNER)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const states = ["IDENTITY_UNLINKED", "SELF_MISSING", "NEEDS_REPAIR", "NOT_STARTED", "IN_PROGRESS", "READY"];
const statuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "MIXED"];
type Row = ModuleRow<SelfFields>;
type Payload = { items: unknown[]; nextCursor: string | null };
function invalid(): never { throw new BoApiError(502,"Core Self Directory trả về dữ liệu không hợp lệ.",null); }
function project(value: unknown): Row {
  if (!value || typeof value !== "object") invalid();
  const r = value as Record<string, unknown>;
  if (typeof r.rowKey !== "string" || !/^(PERSON|STAFF|LEARNER):[0-9a-f-]{36}$/i.test(r.rowKey)
    || !rowId.test(r.rowKey.replace(":", "_")) || typeof r.displayName !== "string"
    || !Array.isArray(r.subjectTypes) || !r.subjectTypes.length
    || r.subjectTypes.some(x => x !== "STAFF" && x !== "LEARNER") || new Set(r.subjectTypes).size !== r.subjectTypes.length
    || !states.includes(String(r.avatarStatus)) || !statuses.includes(String(r.subjectStatus))) invalid();
  for (const key of ["personId","pinoriaSelfId","staffMemberId","studentProfileId"]) if (r[key] !== null && (typeof r[key] !== "string" || !uuid.test(r[key]))) invalid();
  if (r.selfStatus !== null && r.selfStatus !== "ACTIVE" && r.selfStatus !== "ARCHIVED") invalid();
  for (const key of ["loadoutVersion","equippedCount"]) if (r[key] !== null && (!Number.isSafeInteger(r[key]) || Number(r[key]) < 0)) invalid();
  if (r.rowKey.startsWith("PERSON:") !== (r.personId !== null)
     || (r.subjectTypes.includes("STAFF") !== (r.staffMemberId !== null))
     || (r.subjectTypes.includes("LEARNER") !== (r.studentProfileId !== null))) invalid();
  return {
    id: r.rowKey.replace(":", "_"), name: r.displayName, roles: r.subjectTypes.join(" + "), rowKey: r.rowKey,
    avatarStatus: r.avatarStatus as string, subjectStatus: r.subjectStatus as string,
    personId: r.personId as string | null, pinoriaSelfId: r.pinoriaSelfId as string | null,
    staffMemberId: r.staffMemberId as string | null, studentProfileId: r.studentProfileId as string | null,
    selfStatus: r.selfStatus as string | null, loadoutVersion: r.loadoutVersion as number | null, equippedCount: r.equippedCount as number | null,
  };
}
function filters(query: TableQuery<SelfFields>) {
  if (query.group || query.sort || query.filters.logic !== "AND" || query.filters.rules.length > 2) throw new BoApiError(400,"Bộ lọc chưa được Core hỗ trợ.",null);
  const allowed: Record<string,string> = {};
  for (const r of query.filters.rules) {
    if (r.op !== "eq" || !["avatarStatus","subjectStatus"].includes(r.field) || Object.hasOwn(allowed,r.field)) throw new BoApiError(400,"Bộ lọc chưa được Core hỗ trợ.",null);
    if (r.field === "avatarStatus" ? !states.includes(String(r.value)) : !statuses.includes(String(r.value))) throw new BoApiError(400,"Trạng thái không hợp lệ.",null);
    allowed[r.field]=String(r.value);
  }
  if (query.search.length > 120 || /[\u0000-\u001f\u007f]/.test(query.search)) throw new BoApiError(400,"Tìm kiếm không hợp lệ.",null);
  return allowed;
}
function payload(value: unknown): Payload {
  if (!value || typeof value !== "object") invalid();
  const r=value as Record<string,unknown>;
  if (!Array.isArray(r.items) || (r.nextCursor !== null && (typeof r.nextCursor !== "string" || !r.nextCursor || r.nextCursor.length > 4096))) invalid();
  return { items: r.items, nextCursor: r.nextCursor as string | null };
}
/** Cursor cache binds selected Center and query; neither cursor nor local paging grants access. */
export function selfDirectoryProvider(): SurfaceProvider<SelfFields> {
  const known = new Map<string,Row>(); const cursors = new Map<string,Map<number,string | null>>();
  async function page(fetcher: typeof fetch, centerId: string, options: URLSearchParams, cursor: string | null, signal: AbortSignal) {
    const params = new URLSearchParams(options);
    if (cursor) params.set("cursor",cursor);
    const data=payload(await readData(fetcher,"pinoria/avatars?"+params,signal));
    const rows=data.items.map(project);
    if (rows.length>Number(params.get("limit")) || new Set(rows.map(row=>row.id)).size!==rows.length) invalid();
    for(const row of rows) known.set(centerId+":"+row.id,row);
    return { rows, cursor:data.nextCursor };
  }
  return { pagination:"server",
    async list(query,scope,fetcher,signal) {
      if (scope.surface!=="BO" || query.page<1 || query.page>25) throw new BoApiError(400,"Phân trang không hợp lệ.",null);
      const selected=filters(query);
      const params=new URLSearchParams({centerId:scope.centerId,limit:String(query.pageSize),...(query.search?{q:query.search}:{}),...selected});
      const key=scope.centerId+"|"+params.toString();
      let chain=cursors.get(key);if(!chain){chain=new Map([[1,null]]);cursors.set(key,chain);}
      let current=1;while(!chain.has(query.page) && current<query.page) {
        if (!chain.has(current)) { current++;continue; }
        const result=await page(fetcher,scope.centerId,params,chain.get(current)!,signal);
        if (!result.cursor) return { records:[], total:(current-1)*query.pageSize+result.rows.length };
        if (result.cursor===chain.get(current)) invalid();
        chain.set(current+1,result.cursor);current++;
      }
      if (!chain.has(query.page)) return { records:[], total:0 };
      const response=await page(fetcher,scope.centerId,params,chain.get(query.page)!,signal);
      if(response.cursor) chain.set(query.page+1,response.cursor);
      const offset=(query.page-1)*query.pageSize;
      return { records:response.rows.map(row=>({row,centerId:scope.centerId})), total:offset+response.rows.length+(response.cursor?1:0) };
    },
    async detail(id,scope,fetcher,signal) {
      if(scope.surface!=="BO" || !rowId.test(id)) throw new BoApiError(404,"Self Directory row not found",null);
      const found=known.get(scope.centerId+":"+id);
      if (found) return {row:found,centerId:scope.centerId};
      // Deep-link refresh uses bounded Core pages; never return a fabricated record.
      let cursor:string|null=null;const seen=new Set<string>();
      for(let i=0;i<20;i++){
        const result=await page(fetcher,scope.centerId,new URLSearchParams({centerId:scope.centerId,limit:"100"}),cursor,signal);
        const entry=result.rows.find(row=>row.id===id);
        if(entry)return {row:entry,centerId:scope.centerId};
        if(!result.cursor)return null;
        if(seen.has(result.cursor))invalid();
        seen.add(result.cursor);cursor=result.cursor;
      }
      throw new BoApiError(409,"Danh bạ vượt giới hạn tra cứu. Hãy dùng bộ lọc để mở bản ghi.",null);
    },
  };
}
