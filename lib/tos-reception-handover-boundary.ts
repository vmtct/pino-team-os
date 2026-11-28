/** PAP-2431: strict query admission for the existing private TOS handover operations. */
const options="pinoria/house/pickup-options";
const writes=new Set(["pinoria/house/verified-check-out","pinoria/house/check-out"]);
const keys=["centerId","studentProfileId","expectedVisitId","expectedVersion"];
export function receptionHandoverBoundary(method:string,path:string,query:URLSearchParams):400|405|null{
 if(path===options){
  if(method!=="GET")return 405;
  const names=Array.from(query.keys());
  return names.length===keys.length&&keys.every(k=>query.getAll(k).length===1&&!!query.get(k))?null:400;
 }
 if(writes.has(path)){
  if(method!=="POST")return 405;
  return Array.from(query.keys()).length?400:null;
 }
 return null;
}
