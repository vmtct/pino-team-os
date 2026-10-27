import type { BoModule, BoRecord } from "./bo-registration";
import { HO_PAGE_PATHS } from "./ho-routes";
import type { BoLearningSyllabusSummary, BoLearningSyllabusDetail, BoLearningSyllabusOwnerCatalog } from "./bo-model";

export const HO_A1_KEYS = ["syllabi","missions","worlds","wardrobe","wardrobeSets","effects"] as const;
export type HoA1Module = typeof HO_A1_KEYS[number];
export const hoA1Routes:Record<HoA1Module,string> = Object.fromEntries(HO_A1_KEYS.map(k=>[k,HO_PAGE_PATHS[k]])) as Record<HoA1Module,string>;
type FieldSpec = readonly [string,string,"text"|"id"|"select"|"number"|"textarea"|"multiselect"|"date"];
const fields=(specs:readonly FieldSpec[])=>specs.map(([key,label,type])=>({key,label,type,icon:type==="number"?"#":type==="id"?"⌘":"Aa",w:type==="textarea"||type==="multiselect"?275:170,readonly:true}));
export const hoA1Modules:Record<HoA1Module,BoModule>={
 syllabi:{label:"Syllabi",group:"Learning",fields:fields([
  ["name","Syllabus","text"],["id","ID","id"],["code","Code","text"],["owner","Owner","text"],["ownerType","Owner Type","select"],["lifecycle","Lifecycle","select"],["publishedVersion","Published Version","text"],["draftVersion","Draft Version","text"],["versions","Version History","multiselect"],["createdAt","Created At","date"],
 ])},
 missions:{label:"Missions",group:"Learning",fields:fields([
  ["name","Mission","text"],["id","ID","id"],["code","Code","text"],["level","Level","number"],["status","Status","select"],["plsValue","PLS Value","number"],["paperSize","Paper Size","select"],["path","Path","text"],["prerequisite","Prerequisite","text"],["reconciliation","Reconciliation","select"],["description","Description","textarea"],["guideline","Guideline","textarea"],["diagnostics","Diagnostics","multiselect"],
 ])},
 worlds:{label:"World Catalog",group:"Pinoria",fields:fields([
  ["name","World","text"],["id","ID","id"],["key","Key","text"],["status","Status","select"],["worldType","Type","select"],["sceneCount","Scenes","number"],["layerCount","Layers","number"],["scenes","Scene Definitions","multiselect"],["layers","Layer Definitions","multiselect"],["thumbnail","Thumbnail Asset Key","text"],["description","Description","textarea"],
 ])},
 wardrobe:{label:"Wardrobe Catalog",group:"Pinoria",fields:fields([
  ["name","Wearable","text"],["id","ID","id"],["key","Key","text"],["itemType","Item Type","select"],["slot","Slot","text"],["status","Status","select"],["rarity","Rarity Stars","number"],["gender","Gender","select"],["collection","Collection","text"],["season","Season","text"],["variants","Variants · Render & Asset","multiselect"],["tags","Tags","multiselect"],["description","Description","textarea"],
 ])},
 wardrobeSets:{label:"Wardrobe Sets",group:"Pinoria",fields:fields([
  ["name","Set","text"],["id","ID","id"],["key","Key","text"],["status","Status","select"],["memberCount","Members","number"],["members","Member Variants","multiselect"],["webmAssetKey","WEBM Asset Key","text"],
 ])},
 effects:{label:"Effects",group:"Pinoria",fields:fields([
  ["name","Effect","text"],["id","Effect Key","id"],["rarity","Rarity","select"],["implementationVersion","Implementation Version","number"],["capabilities","Capabilities","multiselect"],["description","Description","textarea"],["fullAvatarDescription","Full Avatar","textarea"],["houseMiniDescription","House Mini","textarea"],
 ])},
};

const isObject=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const listOf=(value:unknown):Record<string,unknown>[]=>{
 if(!Array.isArray(value)||value.some(v=>!isObject(v)))throw new Error("Malformed canonical catalog list");
 return value as Record<string,unknown>[];
};
const word=(value:unknown):string=>typeof value==="string"?value:"";
const nullable=(value:unknown):string|null=>word(value)||null;
const numeric=(value:unknown):number=>typeof value==="number"&&Number.isFinite(value)?value:0;
const words=(value:unknown):string[]=>Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"):[];

export function mapHoMissions(value:unknown):BoRecord[]{
 return listOf(value).map(r=>({
  id:word(r.id),name:word(r.name),code:word(r.code),level:numeric(r.level),status:word(r.status),
  plsValue:numeric(r.plsValue),paperSize:nullable(r.paperSize),path:nullable(r.pathKeySnapshot)||nullable(r.pathProgramId),
  prerequisite:nullable(r.prerequisiteCodeSnapshot)||nullable(r.prerequisiteMissionId),
  reconciliation:word(r.reconciliation),description:nullable(r.description),guideline:nullable(r.guideline),
  diagnostics:words(r.diagnostics),
 }));
}
export function mapHoSyllabi(values:BoLearningSyllabusSummary[],owners:BoLearningSyllabusOwnerCatalog,details:BoLearningSyllabusDetail[]):BoRecord[]{
 const byId=new Map(details.map(d=>[d.syllabus.id,d]));
 const ownerName=(o:{type:string;id:string})=>
  o.type==="HOUSE_PATH"?owners.housePaths.find(x=>x.id===o.id)?.displayName??o.id:
  o.type==="HOUSE_CURRICULUM"?owners.houseCurricula.find(x=>x.id===o.id)?.code??o.id:
  owners.toppiPrograms.find(x=>x.id===o.id)?.code??o.id;
 return values.map(x=>{
  const d=byId.get(x.syllabus.id);if(!d)throw new Error("Missing syllabus version detail");
  const s=x.syllabus;
  return {id:s.id,name:x.latestPublishedTitle||d.currentDraft?.title||s.code,code:s.code,
   owner:ownerName(s.owner),ownerType:s.owner.type,lifecycle:s.lifecycle,
   publishedVersion:x.latestPublishedVersionNumber? "v"+x.latestPublishedVersionNumber:null,
   draftVersion:x.currentDraftVersionNumber?"v"+x.currentDraftVersionNumber:null,
   versions:d.versions.map(v=>"v"+v.versionNumber+" · "+v.state+" · "+v.title),
   createdAt:s.createdAt?.slice(0,10)??null};
 });
}
export function mapHoWorlds(value:unknown):BoRecord[]{
 if(!isObject(value))throw new Error("Malformed world catalog");
 return listOf(value.worlds).map(w=>{
  const scenes=listOf(w.scenes);
  const layers=scenes.flatMap(s=>listOf(s.layers).map(l=>({scene:word(s.displayName),layer:l})));
  return {id:word(w.id),name:word(w.displayName),key:word(w.key),status:word(w.status),
   worldType:word(w.worldType),sceneCount:scenes.length,layerCount:layers.length,
   scenes:scenes.map(s=>word(s.displayName)+" · "+word(s.status)+" · "+numeric(s.canvasWidth)+"×"+numeric(s.canvasHeight)),
   layers:layers.map(l=>l.scene+" / "+word(l.layer.displayName)+" · "+word(l.layer.kind)+" · "+word(l.layer.mediaType)),
   thumbnail:nullable(w.thumbnailAssetKey),description:nullable(w.descriptionText)};
 });
}
export function mapHoWardrobe(value:unknown):BoRecord[]{
 if(!isObject(value))throw new Error("Malformed wardrobe catalog");
 const variants=listOf(value.variants);
 return listOf(value.items).map(item=>{
  const byItem=variants.filter(v=>v.wearableId===item.id);
  return {id:word(item.id),name:word(item.displayName),key:word(item.key),itemType:word(item.itemType),
   slot:nullable(item.slot),status:word(item.status),rarity:numeric(item.rarityStars),gender:word(item.gender),
   collection:nullable(item.collectionKey),season:nullable(item.seasonKey),description:nullable(item.descriptionText),
   tags:words(item.tags),variants:byItem.map(v=>[word(v.displayName),word(v.renderMode),word(v.status),word(v.assetKey)].filter(Boolean).join(" · "))};
 });
}
export function mapHoWardSets(value:unknown):BoRecord[]{
 if(!isObject(value))throw new Error("Malformed wardrobe sets");
 return listOf(value.sets).map(x=>({id:word(x.id),name:word(x.displayName),key:word(x.key),
  status:word(x.status),memberCount:numeric(x.memberCount),webmAssetKey:nullable(x.webmAssetKey),
  members:listOf(x.members).map(m=>[word(m.itemName),word(m.variantName),word(m.slot),word(m.renderMode)].filter(Boolean).join(" · "))}));
}
export function mapHoEffects(value:unknown):BoRecord[]{
 return listOf(value).map(x=>({id:word(x.key),name:word(x.displayName),rarity:word(x.rarity),
  implementationVersion:numeric(x.implementationVersion),description:nullable(x.description),
  capabilities:words(x.capabilities),fullAvatarDescription:nullable(x.fullAvatarDescription),houseMiniDescription:nullable(x.houseMiniDescription)}));
}
async function get(fetcher:typeof fetch,path:string):Promise<unknown>{
 const response=await fetcher("/api/bo/"+path,{cache:"no-store",method:"GET"});
 const json:unknown=await response.json().catch(()=>null);
 if(!response.ok||!isObject(json)||!Object.prototype.hasOwnProperty.call(json,"data"))
   throw new Error(response.ok?"Invalid canonical read response":"Catalog GET rejected ("+response.status+")");
 return json.data;
}
export async function loadHoA1(key:HoA1Module,fetcher:typeof fetch):Promise<BoRecord[]>{
 if(key==="syllabi"){
  const [items,owners]=await Promise.all([get(fetcher,"learning/syllabi"),get(fetcher,"learning/syllabi/owners")]);
  if(!Array.isArray(items)||!isObject(owners))throw new Error("Invalid Syllabus catalog");
  const summaries=items as BoLearningSyllabusSummary[],catalog=owners as unknown as BoLearningSyllabusOwnerCatalog;
  if(summaries.length>256)throw new Error("Syllabus directory exceeds view-safe limit; server paging needed");
  const details:BoLearningSyllabusDetail[]=[];
  for(let i=0;i<summaries.length;i+=4){
   const slice=summaries.slice(i,i+4);
   const data=await Promise.all(slice.map(x=>get(fetcher,"learning/syllabi/"+encodeURIComponent(x.syllabus.id))));
   details.push(...data as BoLearningSyllabusDetail[]);
  }
  return mapHoSyllabi(summaries,catalog,details);
 }
 if(key==="missions"){
  const all:BoRecord[]=[],size=50;
  for(let offset=0;offset<5000;offset+=size){
   const part=mapHoMissions(await get(fetcher,"learning/missions?limit="+size+"&offset="+offset));
   all.push(...part);
   if(part.length<size)return all;
  }
  throw new Error("Mission directory exceeds 5000 records; pagination required");
 }
 if(key==="worlds")return mapHoWorlds(await get(fetcher,"pinoria/worlds"));
 if(key==="wardrobe")return mapHoWardrobe(await get(fetcher,"pinoria/ward/catalog"));
 if(key==="wardrobeSets")return mapHoWardSets(await get(fetcher,"pinoria/ward/sets"));
 return mapHoEffects(await get(fetcher,"pinoria/effects/catalog"));
}
