// PAP-2369 / PAP-2367 · SCH-LEARNING-SPACE. M1 only, no transport.
import type { PreviewFeature, PreviewRecord } from "@/lib/m1-preview/contract";
import { reducePreview, type PreviewState } from "@/lib/m1-preview/state";

export const SPACE_PATH = "/ho/learning-spaces";
export const spaceStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type SpaceStatus = typeof spaceStatuses[number];
export const mockCenters = ["Center mẫu"] as const;
export type SpaceFields = {
  center: string; code: string; name: string; optimalCapacity: number;
  hardCapacity: number | null; status: SpaceStatus;
};
export type SpacePreview = PreviewRecord & SpaceFields & {
  version: number; activeClassCount: number; referenceCount: number;
};
export const spaceM1: PreviewFeature<SpacePreview> = {
  feature: "HO-LEARNING-SPACES", jiraTask: "PAP-2369", surface: "HO",
  idPrefix: "LEARNING-SPACE-MOCK-", operations: ["create", "replace", "remove"],
  seed: {id: "LEARNING-SPACE-MOCK-001", fixture: true,
    createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
    center: "Center mẫu", code: "studio-a", name: "Studio A", optimalCapacity: 12,
    hardCapacity: 16, status: "ACTIVE", version: 1, activeClassCount: 1, referenceCount: 1},
};
type SpaceResult = {status:"saved"; state:PreviewState<SpacePreview>; record?:SpacePreview} |
  {status:"invalid"; fields:string[]} | {status:"conflict"|"denied"|"in-use"};
const fields = ["center","code","name","optimalCapacity","hardCapacity","status"] as const;
function normalize(input:Record<string,unknown>):SpaceFields | null {
  const {center,code,name,optimalCapacity,hardCapacity,status} = input;
  if (typeof center !== "string" || !mockCenters.some(c=>c===center) ||
      typeof code !== "string" || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(code.trim().toLowerCase()) ||
      code.trim().length>64 || typeof name!=="string" || !name.trim() || name.trim().length>200 ||
      typeof optimalCapacity!=="number" || !Number.isSafeInteger(optimalCapacity) || optimalCapacity<1 ||
      (hardCapacity!==null && (typeof hardCapacity!=="number" || !Number.isSafeInteger(hardCapacity) || hardCapacity<optimalCapacity)) ||
      !spaceStatuses.some(s=>s===status)) return null;
  return {center,code:code.trim().toLowerCase(),name:name.trim(),optimalCapacity,
    hardCapacity:hardCapacity as number|null,status:status as SpaceStatus};
}
function duplicate(state:PreviewState<SpacePreview>, fields:SpaceFields, ignore?:string) {
  return state.records.some(r=>r.id!==ignore&&r.center===fields.center&&r.code===fields.code);
}
export function createSpace(state:PreviewState<SpacePreview>, input:unknown):SpaceResult {
  if (!input || typeof input!=="object" || Array.isArray(input)) return {status:"invalid",fields:[...fields]};
  const raw=input as Record<string,unknown>;
  if (Object.keys(raw).some(k=>!fields.some(f=>f===k))) return {status:"invalid",fields:[...fields]};
  const data=normalize(raw);
  if (!data) return {status:"invalid",fields:[...fields]};
  if (duplicate(state,data)) return {status:"invalid",fields:["code"]};
  const next=reducePreview(state,{type:"create",record:{...data,fixture:true,version:1,
    activeClassCount:0,referenceCount:0,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null}});
  return {status:"saved",state:next,record:next.records.at(-1)};
}
export function updateSpace(state:PreviewState<SpacePreview>, id:string, patch:unknown, expectedVersion:number):SpaceResult {
  const old=state.records.find(r=>r.id===id);
  if (!old || !old.fixture) return {status:"denied"};
  if (old.version!==expectedVersion) return {status:"conflict"};
  if (!patch || typeof patch!=="object" || Array.isArray(patch)) return {status:"invalid",fields:[...fields]};
  const raw=patch as Record<string,unknown>;
  if (!Object.keys(raw).length || Object.keys(raw).some(k=>k==="center"||!fields.some(f=>f===k))) return {status:"invalid",fields:[...fields]};
  const data=normalize({...old,...raw});
  if (!data) return {status:"invalid",fields:[...fields]};
  if (duplicate(state,data,id)) return {status:"invalid",fields:["code"]};
  if (data.status!=="ACTIVE" && old.activeClassCount>0) return {status:"in-use"};
  const record={...old,...data,version:old.version+1};
  return {status:"saved",state:reducePreview(state,{type:"replace",id,record}),record};
}
export function deleteSpace(state:PreviewState<SpacePreview>, id:string, expectedVersion:number):SpaceResult {
  const row=state.records.find(r=>r.id===id);
  if (!row || !row.fixture) return {status:"denied"};
  if (row.version!==expectedVersion) return {status:"conflict"};
  if (row.referenceCount>0 || row.activeClassCount>0) return {status:"in-use"};
  return {status:"saved",state:reducePreview(state,{type:"remove",id})};
}
export function parseSpaceReviewQuery(query:URLSearchParams) {
  if ([...query.keys()].some(k=>k!=="record") || query.getAll("record").length>1) return null;
  const record=query.get("record");
  if(record!==null&&record!==spaceM1.seed.id) return null;
  return {record:record??undefined};
}
export const linkedClasses = (id:string) => id===spaceM1.seed.id ?
  [{id:"RUNNING-CLASS-MOCK-001",name:"Lớp mỹ thuật mẫu",status:"ACTIVE",center:"Center mẫu"}] : [];
