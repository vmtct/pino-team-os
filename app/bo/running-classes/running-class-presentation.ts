/** PLT-DELIVERY / PAP-1043 / PAP-2225 — presentation projection only. */
import type { BoField, BoModule, BoRecord } from "@/lib/bo-registration";
import { validateClassDraft, type ClassCatalog, type ClassDraft } from "./running-class-draft";

export const RUNNING_CLASS_MOCK_ID = "RUNNING-CLASS-MOCK-001";
export const CLASS_STATUSES = ["ACTIVE","INACTIVE","ARCHIVED"] as const;
export const CLASS_EDIT_KEYS = ["status","pathProgramId","learningSpaceId","operationalName","weekdayIso","windowStartsLocal","windowEndsLocal","optimalConcurrentCapacity","hardConcurrentCapacity","defaultParticipationMinutes"] as const;
export type ClassEditKey = typeof CLASS_EDIT_KEYS[number];
export type ClassEdit = Pick<ClassRecord, ClassEditKey>;
export type ClassRecord = ClassDraft & { id: string; status: string; version: number; createdAt?:string|null; updatedAt?:string|null; createdByName?:string|null; updatedByName?:string|null };
export type ClassEditCommand = { id: string; expectedVersion: number; changes: Partial<ClassEdit> };

function field(key:string,label:string,type:BoField["type"]="text", defaultVisible = true): BoField {
  return {key,label,type,icon:type==="number"?"#":type==="relation"?"↗":type==="date"||type==="datetime"?"▦":type==="select"?"▣":"Aa",w:160,readonly:true,defaultVisible};
}
/** Preserve the served school-adapter table field keys and append audit fields.
 * Additional properties belong to Drawer/Detail, not a replacement table.
 */
export const classAuditFields: BoField[] = [
  field("createdAt","Created Time","datetime"),field("createdBy","Created By"),
  field("updatedAt","Last Modified Time","datetime"),field("updatedBy","Last Modified By")
];
export const classPropertyFields: BoField[] = [
  field("operationalName","Running Class"),field("id","ID","id"),field("centerId","Cơ sở","relation"),
  field("pathProgramId","Path","relation"),field("learningSpaceId","Không gian học","relation"),
  field("weekdayIso","Thứ","number"),field("windowStartsLocal","Giờ bắt đầu"),field("windowEndsLocal","Giờ kết thúc"),
  field("deliveryTopology","Mô hình","select"),field("optimalConcurrentCapacity","Sức chứa tối ưu","number"),
  field("hardConcurrentCapacity","Sức chứa tối đa","number"),field("defaultParticipationMinutes","Thời lượng tham gia (phút)","number"),
  field("status","Trạng thái","select"),field("version","Phiên bản","number"), ...classAuditFields
];
export function classTableModule(baseline:BoModule):BoModule {
  return {...baseline,fields:[...baseline.fields,...classAuditFields.filter(f=>!baseline.fields.some(x=>x.key===f.key))]};
}
const label = (rows: readonly {id:string;displayName:string}[],id:string) => rows.find(r=>r.id===id)?.displayName ?? "—";
export function projectClassRow(record:ClassRecord,catalog:ClassCatalog):BoRecord {
  return {...record,name:record.operationalName,path:label(catalog.paths,record.pathProgramId),center:label(catalog.centers,record.centerId),
    weekday:record.weekdayIso,window:record.windowStartsLocal+" – "+record.windowEndsLocal,capacity:record.optimalConcurrentCapacity,topology:record.deliveryTopology,
    createdAt:record.createdAt??null,createdBy:record.createdByName??"—",updatedAt:record.updatedAt??null,updatedBy:record.updatedByName??"—"};
}
export function projectClassProperties(record:ClassRecord,catalog:ClassCatalog):BoRecord {
  return {...projectClassRow(record,catalog),centerId:label(catalog.centers,record.centerId),
    pathProgramId:label(catalog.paths,record.pathProgramId),learningSpaceId:label(catalog.spaces,record.learningSpaceId)};
}
export function validateClassEdit(original:ClassRecord,draft:ClassRecord,catalog:ClassCatalog):
  {ok:true;command:ClassEditCommand}|{ok:false;message:string} {
  if(!CLASS_STATUSES.some(s=>s===draft.status))return {ok:false,message:"Trạng thái không hợp lệ."};
  const result=validateClassDraft({...draft,centerId:original.centerId,deliveryTopology:original.deliveryTopology},catalog);
  if(!result.ok)return {ok:false,message:Object.values(result.errors).join(" ")};
  const normalized={...result.value,status:draft.status};
  const changes:Partial<ClassEdit>={};
  for(const key of CLASS_EDIT_KEYS)if(normalized[key]!==original[key])Object.assign(changes,{[key]:normalized[key]});
  if(!Object.keys(changes).length)return {ok:false,message:"Không có thay đổi."};
  return {ok:true,command:{id:original.id,expectedVersion:original.version,changes}};
}
