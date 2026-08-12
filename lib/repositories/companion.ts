import { dataSourceId, notion, queryAll } from "@/lib/notion";
import { multiSelectProp, relationIds, selectProp, textProp, dateStartProp } from "@/lib/notion/properties";
import type { NotionPage } from "@/lib/notion/types";
import type { Staff } from "@/lib/domain/staff";

const ECOLOGY_DB = "35f8156e-326f-8023-99ca-eba39f08ec66";
const COMPANION_MASTER_DB = "3808156e-326f-802e-8ca2-000b66a0ef2f";
const COMPANION_LOG_DB = "3878156e-326f-80b9-a316-d7d3a6a477e1";
const STUDENT_DB = "30e8156e-326f-81a3-8485-000b921040ad";

export type CompanionRecord = { id:string; studentId:string; studentName:string; nickname:string; level:string; excitement:string; note:string; ecologyId:string; ecologyName:string };
export type EcologyRecord = { id:string; name:string; archetype:string[]; element:string[]; lv2:string; lv3:string; lv4:string; meaning:string };
export type CompanionLog = { id:string; name:string; date:string; marks:string[]; fruit:number; masterId:string };

export function hasCompanionAccess(staff: Staff): boolean { return staff.employmentStatus === "Active" && staff.companionAccess; }

export async function listCompanions(): Promise<CompanionRecord[]> {
  const [masters, studentPages, ecologyPages] = await Promise.all([queryAll(COMPANION_MASTER_DB), queryAll(STUDENT_DB), queryAll(ECOLOGY_DB)]);
  const studentMap = new Map(studentPages.map((p) => [p.id, textProp(p, "Student Name")]));
  const ecologyMap = new Map(ecologyPages.map((p) => [p.id, textProp(p, "Companion")]));
  return masters.map((p) => {
    const studentId = relationIds(p, "Student")[0] ?? "";
    const ecologyId = relationIds(p, "Companion Name")[0] ?? "";
    return { id:p.id, studentId, studentName:studentMap.get(studentId) ?? "Chưa xác định", nickname:textProp(p,"Nickname"), level:selectProp(p,"Level"), excitement:selectProp(p,"Hào Hứng"), note:textProp(p,"Note"), ecologyId, ecologyName:ecologyMap.get(ecologyId) ?? "Chưa có Hộ Linh" };
  });
}

export async function listEcology(): Promise<EcologyRecord[]> {
  return (await queryAll(ECOLOGY_DB)).map((p) => ({ id:p.id, name:textProp(p,"Companion"), archetype:multiSelectProp(p,"Archetype"), element:multiSelectProp(p,"Elemental Type"), lv2:textProp(p,"Lv2"), lv3:textProp(p,"Lv3"), lv4:textProp(p,"Lv4"), meaning:textProp(p,"Lv4 Emotional Meaning") }));
}

export async function logsForMaster(masterId: string): Promise<CompanionLog[]> {
  return (await queryAll(COMPANION_LOG_DB)).filter((p) => relationIds(p,"Companion Master").includes(masterId)).map((p) => ({ id:p.id, name:textProp(p,"Name"), date:dateStartProp(p,"Date") || String(p.created_time ?? ""), marks:multiSelectProp(p,"Dấu ấn "), fruit:Number((p.properties["Trái Pinoria"] as any)?.number ?? 0), masterId }));
}

export async function createCompanionLog(masterId:string, name:string, marks:string[], fruit:number):Promise<string> {
  const sourceId = await dataSourceId(COMPANION_LOG_DB);
  const response = await notion().pages.create({ parent:{data_source_id:sourceId}, properties:{ Name:{title:[{text:{content:name || "Companion Log"}}]}, "Companion Master":{relation:[{id:masterId}]}, "Trái Pinoria":{number:Number.isFinite(fruit)?fruit:0}, "Dấu ấn ":{multi_select:marks.map((m)=>({name:m}))} } as any });
  return response.id;
}
