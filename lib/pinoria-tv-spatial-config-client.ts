import {validPolygon,boundsOfPoints,pointInsidePolygon} from "./pinoria-tv-mesh-geometry";
export const HOUSE_CANVAS = { width: 1920, height: 1080 } as const;
export type TvConfigScope = {kind:"DEFAULT"} | {kind:"CENTER";centerId:string};
export type Point = {x:number;y:number};
export type Lane = {id:string;x1:number;x2:number;y:number;midLayer:"front"|"behind"};
export type Connector = {id:string;from:Point;to:Point};
export type Area = {id:string;laneIds:string[];bounds:{x:number;y:number;width:number;height:number};points?:Point[];pathCodes?:string[];learningSpaceCodes?:string[]};
export type EmergencePin = {id:string;areaId?:string;laneId:string;x:number;y:number};
export type SpatialConfig = {schemaVersion:1;canvas:{width:1920;height:1080};graph:{horizontalLanes:Lane[];rawConnectors:Connector[]};areas:Area[];emergencePins:EmergencePin[]};
export type SpatialVersion = {id:string;revision:number;createdBy:string;createdAt:string;applied:boolean};
export type SpatialHead = {revision:number;active_version_id:string|null};
export type SpatialVersionDetail = {id:string;revision:number;applied:boolean;configuration:SpatialConfig};
const ROOT = "/api/bo/pinoria/tv-config/spatial/";
export function spatialConfigReadPath(action:"head"|"versions"|"version"|"active",scope:TvConfigScope,versionId?:string) {
  const params = new URLSearchParams();
  if(action==="active") {
    if(scope.kind!=="CENTER")throw new Error("An active TV read needs a Center scope");
    params.set("centerId",scope.centerId);
  } else {
    params.set("scope",scope.kind);
    if(scope.kind==="CENTER")params.set("centerId",scope.centerId);
    if(action==="version"){
      if(!versionId)throw new Error("A versionId is required");
      params.set("versionId",versionId);
    }
  }
  return ROOT+action+"?"+params.toString();
}
async function json<T>(result:Promise<Response>):Promise<T> {
  const response=await result;
  let data:unknown;
  try{data=await response.json();}catch{throw new Error("TV configuration service returned invalid JSON");}
  const body=data as {data?:T;error?:{message?:string}};
  if(!response.ok)throw new Error(body.error?.message ?? "TV configuration operation failed");
  if(!("data" in body))throw new Error("TV configuration payload missing");
  return body.data as T;
}
export const spatialTvConfigApi = {
  head: (scope:TvConfigScope)=>json<SpatialHead|null>(fetch(spatialConfigReadPath("head",scope),{cache:"no-store"})),
  versions: (scope:TvConfigScope)=>json<SpatialVersion[]>(fetch(spatialConfigReadPath("versions",scope),{cache:"no-store"})),
  version: (scope:TvConfigScope,versionId:string)=>json<SpatialVersionDetail|null>(fetch(spatialConfigReadPath("version",scope,versionId),{cache:"no-store"})),
  active: (centerId:string)=>json<{configuration:SpatialConfig;appliedVersion:string;scope:string}|null>(fetch(spatialConfigReadPath("active",{kind:"CENTER",centerId}),{cache:"no-store"})),
  write: async (command:"drafts"|"publish"|"revert",body:unknown) => json<Record<string,unknown>>(fetch(ROOT+command,{
    method:"POST",cache:"no-store",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(body),
  })),
};
export function draftFromSavedGraph(graph:SpatialConfig["graph"]):SpatialConfig {
  return {schemaVersion:1,canvas:{...HOUSE_CANVAS},graph:{horizontalLanes:graph.horizontalLanes.map(l=>({...l})),rawConnectors:graph.rawConnectors.map(c=>({...c,from:{...c.from},to:{...c.to}}))},areas:[],emergencePins:[]};
}
export function configIssues(config:SpatialConfig):string[] {
  const issues:string[]=[];
  const lanes=config.graph.horizontalLanes;
  const ids=new Set(lanes.map(l=>l.id));
  if(config.canvas.width!==1920||config.canvas.height!==1080)issues.push("House canvas must stay 1920×1080");
  if(lanes.length===0)issues.push("Add at least one walkable lane");
  for(const lane of lanes)if(lane.x1<0||lane.x2>1920||lane.y<0||lane.y>1080||lane.x2-lane.x1<72)issues.push("Invalid lane "+lane.id);
  for(const a of config.areas){
    if(a.laneIds.length===0||a.laneIds.some(id=>!ids.has(id)))issues.push("Area "+a.id+" refers to a missing lane or has no lanes");
    if(a.points){
      if(!validPolygon(a.points))issues.push("Invalid polygon "+a.id);
      else{const b=boundsOfPoints(a.points);if(b.x<a.bounds.x||b.y<a.bounds.y||b.x+b.width>a.bounds.x+a.bounds.width||b.y+b.height>a.bounds.y+a.bounds.height)issues.push("Polygon outside bounds "+a.id);}
    }
    if(a.bounds.x<0||a.bounds.y<0||a.bounds.width<=0||a.bounds.height<=0||a.bounds.x+a.bounds.width>1920||a.bounds.y+a.bounds.height>1080)issues.push("Invalid bounds "+a.id);
  }
  const owner=new Map<string,string>();
  for(const a of config.areas)for(const code of [...(a.pathCodes??[]).map(v=>"p:"+v),...(a.learningSpaceCodes??[]).map(v=>"s:"+v)]){
    if(owner.has(code)&&owner.get(code)!==a.id)issues.push("Ambiguous mapping "+code);
    owner.set(code,a.id);
  }
  for(const pin of config.emergencePins){
    const area=config.areas.find(a=>a.id===pin.areaId),lane=lanes.find(l=>l.id===pin.laneId);
    if(!lane||(pin.areaId&&(!area||!area.laneIds.includes(lane.id)))||pin.x<lane.x1+36||pin.x>lane.x2-36||Math.abs(pin.y-lane.y)>0.01
      ||(area?.points&&!pointInsidePolygon({x:pin.x,y:pin.y},area.points)))issues.push("Invalid emergence "+pin.id);
  }
  return issues;
}
