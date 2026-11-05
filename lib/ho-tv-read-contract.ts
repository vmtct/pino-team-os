/** PAP-1418 / PNR-TV: exact Founder HO TV read ingress, no wildcard writer. */
export const HO_TV_READ_PATH = /^\/api\/ho\/pinoria\/(?:tv-health\/(?:displays|devices|operator-health)|tv-config\/(?:spatial|dialogue|policy)\/(?:head|versions|version|active))$/;
const canonicalId = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isHoTvReadRequest = (pathname:string,method:string) =>
  method === "GET" && HO_TV_READ_PATH.test(pathname);
export class InvalidTvReadQuery extends Error {}
function requireKeys(query:URLSearchParams,expected:readonly string[]):void{
  const names=[...query.keys()];
  if(names.length!==expected.length || names.some(k=>query.getAll(k).length!==1 || !expected.includes(k)))
    throw new InvalidTvReadQuery("Unexpected TV read filter");
}
function requireId(value:string|null):string{
  if(!value||!canonicalId.test(value))throw new InvalidTvReadQuery("Invalid canonical ID");
  return value;
}
export function parseHoTvRead(url:URL):{path:string;body:Record<string,unknown>}{
  if(!HO_TV_READ_PATH.test(url.pathname))throw new InvalidTvReadQuery("Unknown TV read route");
  const path=url.pathname.slice("/api/ho/".length),query=url.searchParams;
  if(path==="pinoria/tv-health/displays"||path==="pinoria/tv-health/devices"){
    requireKeys(query,[]);
    return {path,body:{}};
  }
  if(path==="pinoria/tv-health/operator-health"||path.endsWith("/active")){
    requireKeys(query,["centerId"]);
    return {path,body:{centerId:requireId(query.get("centerId"))}};
  }
  const scope=query.get("scope");
  const required=path.endsWith("/version")?["scope","versionId"]:["scope"];
  if(scope==="DEFAULT"){
    requireKeys(query,required);
    return {path,body:{scope:{kind:"DEFAULT"},...(path.endsWith("/version")?{versionId:requireId(query.get("versionId"))}:{})}};
  }
  if(scope==="CENTER"){
    requireKeys(query,[...required,"centerId"]);
    return {path,body:{scope:{kind:"CENTER",centerId:requireId(query.get("centerId"))},
      ...(path.endsWith("/version")?{versionId:requireId(query.get("versionId"))}:{})}};
  }
  throw new InvalidTvReadQuery("Missing or invalid TV config scope");
}
