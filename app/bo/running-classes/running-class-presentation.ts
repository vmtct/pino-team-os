/** PLT-DELIVERY / PAP-1043 / PAP-2225 — presentation projection only. */
import type { BoField, BoModule, BoRecord } from "@/lib/bo-registration";
import { validateClassDraft, type ClassCatalog, type ClassCreate, type ClassDraft } from "./running-class-draft";

export const RUNNING_CLASS_MOCK_ID = "RUNNING-CLASS-MOCK-001";
export const CLASS_EDIT_KEYS = ["operationalName","weekdayIso","windowStartsLocal","windowEndsLocal","optimalConcurrentCapacity","hardConcurrentCapacity","defaultParticipationMinutes"] as const;
export type ClassEditKey = typeof CLASS_EDIT_KEYS[number];
export type ClassEdit = Pick<ClassCreate, ClassEditKey>;
export type ClassRecord = ClassDraft & { id: string; status: string; version: number };
export type ClassEditCommand = { id: string; expectedVersion: number; changes: Partial<ClassEdit>; effectiveFromLocalDate: string | null };

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
    createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
}
export function projectClassProperties(record:ClassRecord,catalog:ClassCatalog):BoRecord {
  return {...projectClassRow(record,catalog),centerId:label(catalog.centers,record.centerId),
    pathProgramId:label(catalog.paths,record.pathProgramId),learningSpaceId:label(catalog.spaces,record.learningSpaceId)};
}
function localDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(value+"T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===value;
}
export function validateClassEdit(original:ClassRecord,draft:ClassDraft,catalog:ClassCatalog,effectiveFromLocalDate:string,centerToday:string):
  {ok:true;command:ClassEditCommand}|{ok:false;message:string} {
  const result=validateClassDraft({...draft,centerId:original.centerId,pathProgramId:original.pathProgramId,learningSpaceId:original.learningSpaceId,deliveryTopology:original.deliveryTopology},catalog);
  if(!result.ok)return {ok:false,message:Object.values(result.errors).join(" ")};
  const changes:Partial<ClassEdit>={};
  for(const key of CLASS_EDIT_KEYS) {
    const value=result.value[key];
    if(value!==original[key]) Object.assign(changes,{[key]:value});
  }
  const keys=Object.keys(changes);
  if(!keys.length)return {ok:false,message:"Không có thay đổi."};
  const requiresDate=keys.some(key=>key!=="operationalName");
  if(requiresDate&&(!localDate(effectiveFromLocalDate)||!localDate(centerToday)||effectiveFromLocalDate<centerToday))
    return {ok:false,message:"Chọn ngày hiệu lực không trước ngày hiện tại của cơ sở."};
  return {ok:true,command:{id:original.id,expectedVersion:original.version,changes,effectiveFromLocalDate:requiresDate?effectiveFromLocalDate:null}};
}
