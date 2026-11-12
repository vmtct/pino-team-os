import type { BoRecord, BoRule } from "@/lib/bo-registration";
import { BoApiError } from "@/lib/bo-api-error";

/** PAP-1810 / PNR-AVATAR-CRUD: Core-read truth, native DSA projection.
 * Shared extraction of the already verified PAP-1779 fail-closed validation.
 * No TDD schema/registry/surface provider import.
 */
export type AvatarRow = BoRecord;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rowId = /^(PERSON|STAFF|LEARNER)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const states = ["IDENTITY_UNLINKED", "SELF_MISSING", "NEEDS_REPAIR", "NOT_STARTED", "IN_PROGRESS", "READY"];
const statuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "MIXED"];
// PAP-1456 / Epic PAP-1097: labels never replace authoritative Core state/filter values.
const avatarLabels: Record<string,string> = {
  IDENTITY_UNLINKED:"Chưa liên kết", SELF_MISSING:"Chưa có Avatar", NEEDS_REPAIR:"Cần khôi phục",
  NOT_STARTED:"Chưa bắt đầu", IN_PROGRESS:"Đang thiết lập", READY:"Sẵn sàng",
};
const subjectLabels: Record<string,string> = {
  ACTIVE:"Đang hoạt động", INACTIVE:"Ngừng hoạt động", ARCHIVED:"Đã lưu trữ", MIXED:"Nhiều trạng thái",
};
const MAX_SELF_SLOTS=8;

function invalid(): never { throw new BoApiError(502,"Core Avatar Directory trả về dữ liệu không hợp lệ.",null); }
// PAP-1779 / PNR-AVATAR-CRUD: timestamp truth from Core, VN display only.
function auditDate(value: unknown): string {
  if (value === null) return "—";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || Number.isNaN(Date.parse(value))) invalid();
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === name)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
}
export function projectAvatarRow(value: unknown): AvatarRow {
  if (!value || typeof value !== "object") invalid();
  const r = value as Record<string, unknown>;
  if (typeof r.rowKey !== "string" || !/^(PERSON|STAFF|LEARNER):[0-9a-f-]{36}$/i.test(r.rowKey)
    || !rowId.test(r.rowKey.replace(":", "_")) || typeof r.displayName !== "string"
    || !Array.isArray(r.subjectTypes) || !r.subjectTypes.length
    || r.subjectTypes.some(x => x !== "STAFF" && x !== "LEARNER") || new Set(r.subjectTypes).size !== r.subjectTypes.length
    || !states.includes(String(r.avatarStatus)) || !statuses.includes(String(r.subjectStatus))) invalid();
  // Older Core projections may omit nickname; never invent a displayed value.
  if (r.nickname != null && (typeof r.nickname !== "string" || r.nickname.length > 40)) invalid();
  for (const key of ["personId","pinoriaSelfId","staffMemberId","studentProfileId"]) if (r[key] !== null && (typeof r[key] !== "string" || !uuid.test(r[key]))) invalid();
  if (r.selfStatus !== null && r.selfStatus !== "ACTIVE" && r.selfStatus !== "ARCHIVED") invalid();
  for (const key of ["loadoutVersion","equippedCount"]) if (r[key] !== null && (!Number.isSafeInteger(r[key]) || Number(r[key]) < 0)) invalid();
  // PAP-1847: never invent the Core Self CAS version. Older rows remain read-only.
  if (r.selfVersion !== undefined && r.selfVersion !== null && (!Number.isSafeInteger(r.selfVersion) || Number(r.selfVersion) < 1)) invalid();
  // PAP-1779 / PNR-AVATAR-CRUD: no client-side guessed audit, count or actor.
  for (const key of ["ownedCount","createdAt","createdBy","updatedAt","updatedBy"]) if (!Object.hasOwn(r,key)) invalid();
  if (r.ownedCount !== null && (!Number.isSafeInteger(r.ownedCount) || Number(r.ownedCount) < 0)) invalid();
  for (const key of ["createdBy","updatedBy"]) if (r[key] !== null
    && (typeof r[key] !== "string" || !(r[key] as string).trim() || (r[key] as string).length > 200)) invalid();
  if (r.pinoriaSelfId === null && (r.ownedCount !== null || r.createdAt !== null || r.createdBy !== null || r.updatedAt !== null || r.updatedBy !== null)) invalid();
  if (r.rowKey.startsWith("PERSON:") !== (r.personId !== null)
     || (r.subjectTypes.includes("STAFF") !== (r.staffMemberId !== null))
     || (r.subjectTypes.includes("LEARNER") !== (r.studentProfileId !== null))) invalid();
  return {
    id: r.rowKey.replace(":", "_"), name: r.displayName, nickname: (r.nickname ?? null) as string | null,
    createdAt: auditDate(r.createdAt), createdBy: (r.createdBy ?? "—") as string,
    updatedAt: auditDate(r.updatedAt), updatedBy: (r.updatedBy ?? "—") as string,
    ownedCount: r.ownedCount as number | null,
    roles: r.subjectTypes.join(" + "), rowKey: r.rowKey,
    avatarLabel: avatarLabels[String(r.avatarStatus)], subjectLabel: subjectLabels[String(r.subjectStatus)],
    loadoutSummary: r.equippedCount === null ? null : String(r.equippedCount)+"/"+MAX_SELF_SLOTS,
    avatarStatus: r.avatarStatus as string, subjectStatus: r.subjectStatus as string,
    personId: r.personId as string | null, pinoriaSelfId: r.pinoriaSelfId as string | null,
    selfVersion: (r.selfVersion ?? null) as number | null,
    staffMemberId: r.staffMemberId as string | null, studentProfileId: r.studentProfileId as string | null,
    selfStatus: r.selfStatus as string | null, loadoutVersion: r.loadoutVersion as number | null, equippedCount: r.equippedCount as number | null,
  };
}

export type AvatarPage = { records: AvatarRow[]; nextCursor: string | null };
export const validAvatarRowId = (id: string) => rowId.test(id);
const denied = (status: number): never => {
  throw new BoApiError(status,
    status === 401 ? "Phiên đăng nhập không còn hiệu lực." :
    status === 403 ? "Không có quyền xem Avatar tại cơ sở này." :
    "Không thể tải danh bạ Avatar.", null);
};
export async function loadAvatarContext(centerId: string, signal: AbortSignal): Promise<ReadonlySet<string>> {
  if (!uuid.test(centerId)) denied(403);
  const response=await fetch("/api/bo/context?"+new URLSearchParams({centerId}),{
    method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal
  });
  if(!response.ok) denied(response.status);
  const body:unknown=await response.json();
  const data=body&&typeof body==="object"&&"data" in body?(body as {data:unknown}).data:null;
  if(!data||typeof data!=="object")invalid();
  const r=data as Record<string,unknown>;
  if(r.surface!=="BO"||r.entitled!==true||typeof r.userId!=="string"||!r.userId.trim()||
    !Array.isArray(r.permissionKeys)||r.permissionKeys.some(p=>typeof p!=="string"))denied(403);
  const allowed=new Set(r.permissionKeys as string[]);
  if(!allowed.has("team.bo.access") || !allowed.has("pinoria.avatar.directory.view"))denied(403);
  return allowed;
}
export function avatarFilterParams(rules: readonly BoRule[]): URLSearchParams {
  if(rules.length>2)throw new BoApiError(400,"Tối đa hai điều kiện lọc Avatar.",null);
  const params=new URLSearchParams();
  for(const rule of rules){
    if(rule.op!=="eq" || !["avatarStatus","subjectStatus"].includes(rule.field) ||
      params.has(rule.field) || rule.value.length>32 ||
      !(rule.field==="avatarStatus" ? states : statuses).includes(rule.value))
      throw new BoApiError(400,"Bộ lọc Avatar chưa được Core hỗ trợ.",null);
    params.set(rule.field,rule.value);
  }
  return params;
}
export async function loadAvatarPage(centerId:string, query:{
  limit:number;search:string;rules:readonly BoRule[];cursor?:string|null
},signal:AbortSignal):Promise<AvatarPage> {
  if(!uuid.test(centerId)||!Number.isSafeInteger(query.limit)||query.limit<1||query.limit>100)denied(400);
  if(query.search.length>120 || /[\u0000-\u001f\u007f]/.test(query.search))denied(400);
  if(query.cursor!=null && (!query.cursor||query.cursor.length>4096))denied(400);
  const params=new URLSearchParams({centerId,limit:String(query.limit),...(query.search?{q:query.search}:{} )});
  avatarFilterParams(query.rules).forEach((v,k)=>params.set(k,v));
  if(query.cursor)params.set("cursor",query.cursor);
  const response=await fetch("/api/bo/pinoria/avatars?"+params,{
    method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal
  });
  if(!response.ok)denied(response.status);
  const root:unknown=await response.json();
  const raw=root&&typeof root==="object"&&"data" in root?(root as {data:unknown}).data:null;
  if(!raw||typeof raw!=="object")invalid();
  const item=raw as Record<string,unknown>;
  if(!Array.isArray(item.items)||item.items.length>query.limit||
    (item.nextCursor!==null && (typeof item.nextCursor!=="string"||
       !item.nextCursor||item.nextCursor.length>4096)))invalid();
  const records=item.items.map(projectAvatarRow);
  if(new Set(records.map(row=>row.id)).size!==records.length)invalid();
  return {records,nextCursor:item.nextCursor as string|null};
}
