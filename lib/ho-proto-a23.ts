import type { BoModule } from "./bo-registration";
export const protoRoutes = {
  tvPolicy:"/ho/pinoria/tv-policy",
  cms:"/ho/content/website-cms",
  wish:"/ho/pinoria/wish",
  activities:"/ho/pinoria/activities",
} as const;
export type ProtoKey = keyof typeof protoRoutes;
type Field = readonly [string,string,"text"|"id"|"select"|"number"|"date"|"textarea"|"multiselect"];
const fields=(s:readonly Field[])=>s.map(([key,label,type])=>({key,label,type,icon:type==="number"?"#":type==="id"?"⌘":"Aa",w:["textarea","multiselect"].includes(type)?320:185,readonly:true}));
export const protoModules:Record<ProtoKey,BoModule>={
 tvPolicy:{label:"TV Projection Policy",group:"Pinoria",fields:fields([
  ["name","Scope / Center","text"],["id","ID","id"],["scope","Scope","select"],["center","Center","text"],["resolution","Resolution","select"],["activeVersion","Effective Version","text"],["headVersion","Head Version","text"],["source","Source","text"],["updatedAt","Updated","date"],["settingSummary","Policy Details","textarea"],["versions","Version History","multiselect"]])},
 cms:{label:"Website CMS",group:"Content",fields:fields([
  ["name","Slot","text"],["id","ID","id"],["site","Website","select"],["page","Page","text"],["slotKey","Slot Key","text"],["contentKind","Content Kind","select"],["status","Status","select"],["publishedVersion","Published Revision","number"],["draftVersion","Draft Revision","number"],["updatedAt","Updated","date"],["preview","Content Preview","textarea"],["history","Revision History","multiselect"]])},
 wish:{label:"Wish",group:"Pinoria",fields:fields([
  ["name","Configuration","text"],["id","ID","id"],["kind","Kind","select"],["code","Key","text"],["status","Status","select"],["phase","Release Phase","text"],["rules","Rule Binding","text"],["availability","Availability","text"],["updatedAt","Updated","date"],["description","Description","textarea"],["relations","Relations","multiselect"]])},
 activities:{label:"Pinoria Activities",group:"Pinoria",fields:fields([
  ["name","Activity","text"],["id","ID","id"],["code","Code","text"],["type","Handler","select"],["center","Center / GLOBAL","select"],["status","Status","select"],["startAt","Starts","date"],["endAt","Ends","date"],["region","Region","text"],["reward","Reward / Conditions","text"],["updatedAt","Updated","date"],["description","Description","textarea"]])},
};
