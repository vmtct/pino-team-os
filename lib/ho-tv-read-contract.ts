/** PAP-1418 / PNR-TV: exact Founder HO TV read ingress, no wildcard writer. */
export const HO_TV_READ_PATH = /^\/api\/ho\/pinoria\/(?:tv-health\/(?:displays|devices|operator-health)|tv-config\/(?:spatial|dialogue|policy)\/(?:head|versions|version|active)|tv-policies\/directory)$/;
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
  if(path==="pinoria/tv-policies/directory"){
    const names=[...query.keys()];
    if(names.some(k=>!["limit","offset"].includes(k)||query.getAll(k).length!==1))
      throw new InvalidTvReadQuery("Unexpected Policy directory query");
    const limit=query.has("limit")?Number(query.get("limit")):25;
    const offset=query.has("offset")?Number(query.get("offset")):0;
    if((query.has("limit")&&!/^[1-9][0-9]*$/.test(query.get("limit")??"")) ||
      (query.has("offset")&&!/^(?:0|[1-9][0-9]*)$/.test(query.get("offset")??"")) ||
      !Number.isSafeInteger(limit)||limit<1||limit>50||!Number.isSafeInteger(offset)||offset<0||offset>10000)
      throw new InvalidTvReadQuery("Invalid Policy directory pagination");
    return {path,body:{limit,offset}};
  }
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
