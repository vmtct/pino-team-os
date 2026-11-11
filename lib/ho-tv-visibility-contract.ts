/** PAP-1385 / PNR-TV: Staging Founder HO logical visibility ingress only. */
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const canonicalCenter=new RegExp("^"+uuid+"$");
export const HO_TV_VISIBILITY_PATH=new RegExp(
  "^/api/ho/pinoria/tv-policies/visibility/(?:tvp1-default|tvp1-center-"+uuid+")$",
);
export class InvalidTvVisibilityInput extends Error {}
const bad=():never=>{throw new InvalidTvVisibilityInput("Invalid TV visibility input");};
export function isHoTvVisibilityRequest(pathname:string,method:string):boolean {
  return (method==="GET"||method==="PATCH")&&HO_TV_VISIBILITY_PATH.test(pathname);
}
function exactKeys(body:Record<string,unknown>,expected:readonly string[]):void{
  const actual=Object.keys(body);
  if(actual.length!==expected.length||actual.some(k=>!expected.includes(k)))bad();
}
function center(value:unknown):string {
  if(typeof value!=="string"||!canonicalCenter.test(value))bad();
  return value as string;
}
export function hoTvVisibilityGet(url:URL):Record<string,unknown>{
  if(!isHoTvVisibilityRequest(url.pathname,"GET"))bad();
  if([...url.searchParams.keys()].length!==1||url.searchParams.getAll("selectedCenterId").length!==1)bad();
  return {selectedCenterId:center(url.searchParams.get("selectedCenterId"))};
}
export function hoTvVisibilityPatch(url:URL,value:unknown):Record<string,unknown>{
  if(!isHoTvVisibilityRequest(url.pathname,"PATCH")||url.search||!value||
    typeof value!=="object"||Array.isArray(value))bad();
  const body=value as Record<string,unknown>;
  exactKeys(body,["selectedCenterId","name","scope","assignedCenterIds","expectedRevision"]);
  center(body.selectedCenterId);
  if(typeof body.name!=="string"||body.name!==body.name.trim()||
    body.name.length<1||body.name.length>200)bad();
  if(body.scope!=="DEFAULT"&&body.scope!=="CENTER")bad();
  const assignments=body.assignedCenterIds;
  if(!Array.isArray(assignments)||assignments.length>100)bad();
  const ids=(assignments as unknown[]).map(center);
  if(new Set(ids).size!==ids.length||body.scope==="DEFAULT"&&ids.length>0)bad();
  if(!Number.isSafeInteger(body.expectedRevision)||(body.expectedRevision as number)<0)bad();
  return {...body,assignedCenterIds:ids};
}
