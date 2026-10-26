import type { BoRecord } from "./bo-registration";
export type FixtureMode = "production" | "demo";
/** Counts and status distributions are from read-only aggregate SQL on pino-core-prod, 2026-10-26.
 * All individual records below are DETERMINISTIC FICTION. Never hydrate this module from live D1. */
export const prodCounts = Object.freeze({
 centers:2,users:17,roles:7,audits:266,syllabi:0,missions:0,worlds:1,
 wardrobe:25,wardrobeSets:3,activities:0,tvHeads:0,cms:0,wishBanners:0,wishRules:1,
});
const id=(domain:number,index:number)=>`00000000-0000-4000-8000-${String(domain*10000+index+1).padStart(12,"0")}`;
const stamp=(n:number)=>`2026-10-${String(26-(n%20)).padStart(2,"0")}`;
const centers=["PINO House (mô phỏng)","PINO Station 02 (mô phỏng)"];
const paths=["Art","Piano","Design","Anime"];
const statuses=["ACTIVE","DRAFT","ARCHIVED"];
function centerRows():BoRecord[] {return centers.map((name,i)=>({id:id(1,i),name,centerKey:i?"STATION-02":"HOUSE",timeZone:"Asia/Ho_Chi_Minh",status:"active"}));}
function userRows():BoRecord[]{return Array.from({length:17},(_,i)=>({
 id:id(2,i),name:`staff${String(i+1).padStart(3,"0")}@example.invalid`,
 status:"active",staffMemberId:id(3,i),roleAssignments:[i===0?"Founder · GLOBAL":i<5?"Teacher · CENTER":"Reception · CENTER"],
}));}
function roleRows():BoRecord[]{return ["Founder","GM","Center Manager","Shift Leader","Teacher","Reception","Retired Role"].map((name,i)=>({
 id:id(4,i),name,roleKey:name.toUpperCase().replace(/ /g,"_"),roleType:i<6?"system":"custom",
 status:i===6?"archived":"active",description:"Vai trò mô phỏng; không dùng quyền thật.",
 permissionCount:[138,71,48,21,17,12,0][i],assignmentCount:[1,1,2,2,7,4,0][i],
 permissionKeys:i===0?["access.user.view","access.role.view","catalog.learning.view","content.web.view"]:["access.user.view"],
}));}
function syllabusRows(mode:FixtureMode):BoRecord[]{return Array.from({length:mode==="demo"?4:0},(_,i)=>({
 id:id(5,i),name:`${paths[i]} Syllabus – sample`,code:`SL-${String(i+1).padStart(3,"0")}`,
 owner:paths[i],ownerType:i===3?"TOPPI_PROGRAM":"HOUSE_PATH",lifecycle:i===3?"DRAFT":"ACTIVE",
 publishedVersion:i===3?null:"v1",draftVersion:"v2",versions:["v1 · PUBLISHED","v2 · DRAFT"],createdAt:stamp(i),
}));}
function missionRows(mode:FixtureMode):BoRecord[]{return Array.from({length:mode==="demo"?51:0},(_,i)=>({
 id:id(6,i),name:`Nhiệm vụ ${paths[i%4]} ${String(i+1).padStart(2,"0")}`,code:`MISSION-${String(i+1).padStart(3,"0")}`,
 level:1+(i%5),status:i%9?"ACTIVE":"INACTIVE",plsValue:10+5*(i%5),paperSize:["B5","A4","A3"][i%3],
 path:paths[i%4],prerequisite:i%5?"MISSION-"+String(i).padStart(3,"0"):null,
 reconciliation:"READY",description:"Mô tả nhiệm vụ mẫu theo catalog.",guideline:"Đọc giáo án, chuẩn bị vật liệu và hướng dẫn học viên.",
 diagnostics:i%9?["READY"]:["ARCHIVED"],
}));}
function worldRows(mode:FixtureMode):BoRecord[]{return Array.from({length:mode==="demo"?3:1},(_,i)=>({
 id:id(7,i),name:["Chroma Sea","Forest of Echoes","Crystal Mountains"][i],key:["CHROMA_SEA","ECHO_FOREST","CRYSTAL_MOUNTAINS"][i],
 status:i===0?"DRAFT":"ACTIVE",worldType:"CORE",sceneCount:i+2,layerCount:(i+2)*4,
 scenes:[`Scene 1 · 1920×1080`,`Scene 2 · 1920×1080`],layers:["BACKGROUND · PNG","FOREGROUND · WEBP","CHARACTER · PNG"],
 description:"World catalog mẫu, không chứa instance của learner.",thumbnail:null,
}));}
function wearableRows():BoRecord[]{return Array.from({length:25},(_,i)=>({
 id:id(8,i),name:`${["Luminous Cape","Coral Crown","Celestial Boots","Ink Brush","Aura Spark"][i%5]} ${Math.floor(i/5)+1}`,
 key:`WEARABLE_${String(i+1).padStart(3,"0")}`,itemType:"WEARABLE",slot:["BACK","HEADWEAR","OUTFIT","BACK_AURA","PATH_MARK"][i%5],
 status:i<21?"ACTIVE":"DRAFT",rarity:1+i%5,gender:"UNISEX",collection:["CHROMA","EVERGREEN"][i%2],
 season:"2026",description:"Vật phẩm mô phỏng cho kiểm thử giao diện.",tags:["wardrobe",paths[i%4]],
 variants:[`Base · LAYER · ACTIVE · demo-assets/${i+1}.webp`,`Rare · LAYER · DRAFT`],
}));}
function setRows():BoRecord[]{return Array.from({length:3},(_,i)=>({
 id:id(9,i),name:["Chroma Explorer","Mori Companion","Prism Adventurer"][i],
 key:`WARD_SET_${i+1}`,status:i===2?"ARCHIVED":"DRAFT",
 memberCount:3+i,members:["Coral Crown · HEADWEAR","Luminous Cape · BACK","Celestial Boots · OUTFIT"],
 webmAssetKey:null,
}));}
function effectRows():BoRecord[]{return ["Glow","Particles","Trail","Pulse"].map((name,i)=>({
 id:`effect-${i+1}`,name,rarity:["COMMON","RARE","EPIC","LEGENDARY"][i],
 implementationVersion:1,capabilities:["Avatar","House Mini"],description:`${name} static catalog effect`,
 fullAvatarDescription:"Hiệu ứng mẫu avatar",houseMiniDescription:"Hiệu ứng mẫu mini",
}));}
function tvRows(mode:FixtureMode):BoRecord[]{
 const scenarios=mode==="demo"?
  [{scope:"DEFAULT",center:"All Centers",resolution:"ACTIVE · DEFAULT",activeVersion:"v3",headVersion:"v4",source:"DEFAULT"},
   {scope:"CENTER",center:centers[0],resolution:"Override",activeVersion:"v2",headVersion:"v2",source:"CENTER"},
   {scope:"CENTER",center:centers[1],resolution:"Inherited DEFAULT",activeVersion:"v3",headVersion:null,source:"DEFAULT"}]:
  [{scope:"DEFAULT",center:"All Centers",resolution:"Unconfigured",activeVersion:null,headVersion:null,source:"—"},
   ...centers.map(center=>({scope:"CENTER",center,resolution:"Unconfigured",activeVersion:null,headVersion:null,source:"—"}))];
 return scenarios.map((x,i)=>({
 id:id(10,i),name:x.scope==="DEFAULT"?"Default policy":x.center,
 scope:x.scope,center:x.center,resolution:x.resolution,activeVersion:x.activeVersion,
 headVersion:x.headVersion,source:x.source,updatedAt:mode==="demo"?stamp(i):null,
 settingSummary:mode==="demo"?"Projection 16:9 · scene mesh · safe-zone · Pinoria TV":"Chưa có policy trên Production",
 versions:mode==="demo"?["v1 · published","v2 · active","v3 · active","v4 · draft"]:[],
 }));
}
function cmsRows(mode:FixtureMode):BoRecord[]{const sites=["PINOHOUSE","TOPPI","AFTERWORK"];return Array.from({length:mode==="demo"?9:0},(_,i)=>({
 id:id(11,i),name:`${sites[Math.floor(i/3)]} · ${["Hero","About Us","Program Spotlight"][i%3]}`,
 site:sites[Math.floor(i/3)],page:["Home","About","Programs"][i%3],slotKey:`home.${["hero","about","programs"][i%3]}`,
 contentKind:i%3?"TEXT":"MEDIA",status:i%4?"PUBLISHED":"DRAFT",
 publishedVersion:i%4?2:0,draftVersion:3,updatedAt:stamp(i),
 preview:"Họa ước mơ, hòa ký ức. Nội dung kiểm thử — không phải nội dung Production.",
 history:["rev1 · draft","rev2 · published","rev3 · draft"],
}));}
function wishRows(mode:FixtureMode):BoRecord[]{
 const kinds=mode==="demo"?["RULE","BANNER","BANNER","BANNER","CATALOG","CATALOG","RELEASE_PHASE"] : ["RULE"];
 return kinds.map((kind,i)=>({
 id:id(12,i),name:["Wish Rules – sample","Prism Light","Mori Arrival","Winter Constellation","Rare Wearables","Standard Wardrobe","Season 2026"][i],
 kind,code:`WISH_${kind}_${i+1}`,status:mode==="production"?"DRAFT":i%3?"ACTIVE":"DRAFT",
 phase:i>0?"CHROMA_SEA":null,rules:"WISH_RULE_1",availability:mode==="production"?"Unconfigured":"2026-10-01 → 2026-12-31",
 updatedAt:stamp(i),description:"Wish configuration demo; không có giao dịch hay ví của learner.",
 relations:["WISH_RULE_1","CHROMA_SEA"],
 }));
}
function activityRows(mode:FixtureMode):BoRecord[]{return Array.from({length:mode==="demo"?6:0},(_,i)=>({
 id:id(13,i),name:["Prism Quest","Mori Care","Weekly Sketch","Sound Lab","Planet Explorer","Showcase Interview"][i],
 code:`ACT-${String(i+1).padStart(3,"0")}`,type:["MISSION","COMPANION","DRAW","PIANO","EXPLORATION","SHOWCASE"][i],
 center:i%3===0?"GLOBAL":centers[(i+1)%2],status:i===5?"ARCHIVED":i%2?"SCHEDULED":"ACTIVE",
 startAt:stamp(i),endAt:"2026-12-31",region:i%2?"EVERGREEN":"CHROMA_SEA",
 reward:`${10+i*5} PLS · completion`,updatedAt:stamp(i),
 description:"Định nghĩa hoạt động mô phỏng; không tạo reward hoặc schedule thật.",
}));}
export function protoRows(key:string,mode:FixtureMode):BoRecord[]{
 switch(key){
  case "centers":return centerRows();
  case "users":return userRows();
  case "roles":return roleRows();
  case "audits":return [];
  case "syllabi":return syllabusRows(mode);
  case "missions":return missionRows(mode);
  case "worlds":return worldRows(mode);
  case "wardrobe":return wearableRows();
  case "wardrobeSets":return setRows();
  case "effects":return effectRows();
  case "tvPolicy":return tvRows(mode);
  case "cms":return cmsRows(mode);
  case "wish":return wishRows(mode);
  case "activities":return activityRows(mode);
  default:throw new Error("Unknown prototype module");
 }
}
export const protoAuditRows=Array.from({length:266},(_,i)=>({
 id:id(14,i),requestId:id(15,i),occurredAt:`2026-10-${String(26-(i%25)).padStart(2,"0")}T10:00:00.000Z`,
 actorType:"system_user",actorId:id(2,i%17),subjectType:i%2?"access_role":"access_user",
 subjectId:id(i%2?4:2,i%17),action:["ACCESS_USER_CREATED","ACCESS_ROLE_ASSIGNED","ACCESS_ROLE_UPDATED","ACCESS_ROLE_REVOKED"][i%4],
 outcome:i%13?"succeeded":"denied",payload:undefined,
}));
