export type InstanceGridUrlState={query:string;status:""|"LIVE"|"INACTIVE"|"REVOKED";worldId:string;page:number;size:10|25|50|100;sortKey:"grantedAt"|"studentName"|"worldName"|"status"|"label";sortDirection:"asc"|"desc";instanceId:string|null};
const sorts=new Set(["grantedAt","studentName","worldName","status","label"]);
const sizes=new Set([10,25,50,100]);
export const DEFAULT_INSTANCE_GRID:InstanceGridUrlState={query:"",status:"",worldId:"",page:1,size:25,sortKey:"grantedAt",sortDirection:"desc",instanceId:null};
export function parseInstanceGridParams(p:URLSearchParams):InstanceGridUrlState{
 const s=p.get("i_status")??"",page=Number(p.get("i_page")),size=Number(p.get("i_size")),key=p.get("i_sort")??"",dir=p.get("i_dir")??"";
 return {query:(p.get("i_query")??"").slice(0,120),status:s==="LIVE"||s==="INACTIVE"||s==="REVOKED"?s:"",
  worldId:(p.get("i_world")??"").slice(0,120),page:Number.isSafeInteger(page)&&page>0?page:1,
  size:sizes.has(size)?size as InstanceGridUrlState["size"]:25,
  sortKey:sorts.has(key)?key as InstanceGridUrlState["sortKey"]:"grantedAt",
  sortDirection:dir==="asc"?"asc":"desc",instanceId:p.get("instance")||null};
}
export function writeInstanceGridParams(input:URLSearchParams,state:InstanceGridUrlState):URLSearchParams{
 const p=new URLSearchParams(input);
 for(const key of ["i_query","i_status","i_world","i_page","i_size","i_sort","i_dir","instance"])p.delete(key);
 if(state.query)p.set("i_query",state.query);
 if(state.status)p.set("i_status",state.status);
 if(state.worldId)p.set("i_world",state.worldId);
 if(state.page!==1)p.set("i_page",String(state.page));
 if(state.size!==25)p.set("i_size",String(state.size));
 if(state.sortKey!=="grantedAt")p.set("i_sort",state.sortKey);
 if(state.sortDirection!=="desc")p.set("i_dir",state.sortDirection);
 if(state.instanceId)p.set("instance",state.instanceId);
 return p;
}
