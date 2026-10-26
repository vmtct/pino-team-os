import { hoAccessReadAllowed } from "./ho-access-guard";
const allowed = new Set(["learning/missions","learning/syllabi"]);
export function validateHoA1Query(path:string,params:URLSearchParams):void{
 if(!hoAccessReadAllowed(path))return;
 if(!["learning/missions","learning/syllabi","learning/syllabi/owners","pinoria/worlds","pinoria/ward/catalog","pinoria/ward/sets","pinoria/effects/catalog"].includes(path) && !/^learning\/(?:syllabi|missions)\/[0-9a-f-]{36}$/.test(path))return;
 const valid=path==="learning/missions"?new Set(["limit","offset","search","status","level","pathProgramId"]):
   path==="learning/syllabi"?new Set(["ownerType","ownerId"]):new Set<string>();
 for(const key of params.keys()){
  if(!valid.has(key)||params.getAll(key).length!==1)throw new RangeError("Invalid HO catalog query");
 }
 if(!allowed.has(path))return;
 for(const key of ["limit","offset"] as const) {
  const v=params.get(key);
  if(v!==null&&(!/^(0|[1-9][0-9]*)$/.test(v)||Number(v)>(key==="limit"?100:1000000) ||(key==="limit"&&Number(v)<1)))throw new RangeError("Invalid HO catalog paging");
 }
 for(const key of ["search","pathProgramId","ownerId"]){
  const v=params.get(key);
  if(v!==null&&(v.length>120||/[\x00-\x1f]/.test(v)))throw new RangeError("Invalid HO catalog filter");
 }
 const level=params.get("level");
 if(level!==null&&(!/^[1-5]$/.test(level)))throw new RangeError("Invalid HO level");
 const status=params.get("status");
 if(status!==null&&!["ACTIVE","INACTIVE"].includes(status))throw new RangeError("Invalid HO status");
 const ownerType=params.get("ownerType");
 if(ownerType!==null&&!["HOUSE_PATH","HOUSE_CURRICULUM","TOPPI_PROGRAM"].includes(ownerType))throw new RangeError("Invalid HO owner type");
 if((ownerType!==null)!==(params.get("ownerId")!==null))throw new RangeError("Missing HO owner");
}
