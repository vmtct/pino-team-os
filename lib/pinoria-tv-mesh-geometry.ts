import type {Area,EmergencePin,Lane,Point,SpatialConfig} from "./pinoria-tv-spatial-config-client";

export type PrototypeAreaSnapshot={
  canvas:{width:number;height:number};
  areas:Array<{id:string;label:string;points:Point[]}>;
};
export type PrototypeEmergenceSnapshot={canvas:{width:number;height:number};pin:{laneId:string;x:number;y:number}};
export function boundsOfPoints(points:readonly Point[]){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
export function pointInsidePolygon(point:Point,polygon:readonly Point[]){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i]!,b=polygon[j]!;
    if(((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
  }
  return inside;
}
export function validPolygon(points:readonly Point[]){
  if(points.length<3||points.length>32||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1920||p.y<0||p.y>1080))return false;
  const sum=points.reduce((total,p,i)=>{const q=points[(i+1)%points.length]!;return total+p.x*q.y-q.x*p.y;},0);
  return Math.abs(sum)>200;
}
export function prototypeSpatialDraft(
  base:SpatialConfig,
  areas:PrototypeAreaSnapshot,
  emergence:PrototypeEmergenceSnapshot,
):SpatialConfig{
  if(areas.canvas.width!==1920||areas.canvas.height!==1080||emergence.canvas.width!==1920||emergence.canvas.height!==1080)throw new Error("Prototype is not canonical 16:9");
  const lanes=base.graph.horizontalLanes;
  const prepared:Area[]=areas.areas.map(area=>{
    if(!validPolygon(area.points))throw new Error("Invalid prototype Area "+area.id);
    // Geometric occupancy of a lane is a visual proposal, not a guessed Path mapping.
    const laneIds=lanes.filter(l=>pointInsidePolygon({x:(l.x1+l.x2)/2,y:l.y},area.points)).map(l=>l.id);
    return {id:area.id,bounds:boundsOfPoints(area.points),points:area.points.map(p=>({...p})),laneIds,pathCodes:[],learningSpaceCodes:[]};
  });
  const pin=emergence.pin;
  const lane=lanes.find(l=>l.id===pin.laneId);
  const pins:EmergencePin[]=lane&&pin.x>=lane.x1+36&&pin.x<=lane.x2-36&&Math.abs(pin.y-lane.y)<0.01
    ?[{id:"prototype-global-emergence",laneId:pin.laneId,x:pin.x,y:pin.y}]:[];
  return {...base,areas:prepared,emergencePins:pins};
}
export function translatePolygon(points:readonly Point[],dx:number,dy:number){
  const bounds=boundsOfPoints(points);
  const x=Math.max(-bounds.x,Math.min(dx,1920-bounds.x-bounds.width));
  const y=Math.max(-bounds.y,Math.min(dy,1080-bounds.y-bounds.height));
  return points.map(p=>({x:p.x+x,y:p.y+y}));
}
export function snapPrototypePinToLane(point:Point,lanes:readonly Lane[]) {
  return [...lanes].sort((a,b)=>Math.abs(a.y-point.y)-Math.abs(b.y-point.y))[0]??null;
}
