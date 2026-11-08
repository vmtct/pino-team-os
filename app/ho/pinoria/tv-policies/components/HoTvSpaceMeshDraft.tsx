"use client";
/* PAP-1385 / PNR-TV FSG0_SPACE_DELTA_APPROVED - read-only baseline + unsaved local FE candidate; NEVER publish.\n   PAP-1448 / PNR-TV · Approved 1920×1080 House geometry and three real House art layers.
   Checkpoints are LOCAL REVIEW overlays, not a Core-persisted field. No live TV writes. */
import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from "react";
type HoTvSpaceRecord={scope?:string|null};
import {createAmbientAgents,stepAmbientAgents,resolveAmbientConnectors,type AmbientAgent,type AmbientMotionGraph} from "@/app/pinoria-tv/ambient-house-motion";
import graphSeed from "@/app/pinoria-tv/ambient-house-motion-graph.saved.json";
import approvedAreas from "@/app/pinoria-tv/ambient-house-areas.prototype.json";
import approvedEmergence from "@/app/pinoria-tv/ambient-house-emergence.prototype.json";
import "@pino/design-system/spatial-editor.css";
import {SpatialEditorFrame,SpatialVertexHandle} from "@pino/design-system/spatial-editor";

type Point={x:number;y:number};
type Lane={id:string;x1:number;x2:number;y:number;midLayer:"front"|"behind"};
type Connector={id:string;from:Point;to:Point};
type Area={id:string;label:string;points:Point[]};
type Pin={id:string;laneId:string;x:number;y:number};
type Checkpoint={id:string;label:string;laneId:string;x:number;y:number};
type Mesh={lanes:Lane[];connectors:Connector[];areas:Area[];pins:Pin[];checkpoints:Checkpoint[]};
type Kind="lane"|"connector"|"area"|"pin"|"checkpoint";
type Pick={kind:Kind;id:string};
type Tool="select"|"lane"|"connector"|"checkpoint"|"area"|"pin";
type Visibility={back:boolean;mid:boolean;front:boolean;lanes:boolean;connectors:boolean;areas:boolean;pins:boolean;checkpoints:boolean;grid:boolean};
const HOUSE={back:"https://assets.pinohouse.art/draft/HouseBack.png",mid:"https://assets.pinohouse.art/draft/HouseMid.png",front:"https://assets.pinohouse.art/draft/HouseFront.png"} as const;
const WORLD={width:1920,height:1080};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const snap=(n:number,step:number)=>Math.round(n/step)*step;
const newId=(prefix:string,values:{id:string}[])=>prefix+"-"+String(1+Math.max(0,...values.map(v=>Number(v.id.match(/\d+$/)?.[0]??0)))).padStart(2,"0");
const bounds=(points:Point[])=>({x:Math.min(...points.map(x=>x.x)),y:Math.min(...points.map(x=>x.y)),w:Math.max(...points.map(x=>x.x))-Math.min(...points.map(x=>x.x)),h:Math.max(...points.map(x=>x.y))-Math.min(...points.map(x=>x.y))});
const poly=(points:Point[])=>points.map(p=>p.x+","+p.y).join(" ");
const isValidPolygon=(points:Point[])=>{
 if(points.length<3||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>1920||p.y>1080))return false;
 const signed=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0);
 if(Math.abs(signed)<250)return false;
 const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  if(a.x===b.x&&a.y===b.y)return false;
  for(let j=i+1;j<points.length;j++){
   if(i===j||(i+1)%points.length===j||(j+1)%points.length===i)continue;
   const c=points[j],d=points[(j+1)%points.length];
   if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return false;
  }
 }
 return true;
};
const seedMesh=():Mesh=>{
 const lanes=graphSeed.horizontalLanes.map(l=>({...l,midLayer:l.midLayer==="behind"?"behind" as const:"front" as const}));
 const connectors=graphSeed.rawConnectors.map(c=>({id:c.id,from:{...c.from},to:{...c.to}}));
 const areas=approvedAreas.areas.map(a=>({id:a.id,label:a.label,points:a.points.map(p=>({...p}))}));
 const pins=[{id:"emergence-main",laneId:approvedEmergence.pin.laneId,x:approvedEmergence.pin.x,y:approvedEmergence.pin.y}];
 // No checkpoint has been Founder-approved as a business waypoint. Do not fake one on top of the approved emergence pin.
 const checkpoints:Checkpoint[]=[];
 return {lanes,connectors,areas,pins,checkpoints};
};
const tools:readonly {id:Tool;icon:string;label:string;hint:string}[]=[
 {id:"select",icon:"↖",label:"Chọn / Di chuyển",hint:"Chọn đường, vùng, pin hoặc checkpoint rồi kéo trên House."},
 {id:"lane",icon:"━",label:"Đường đi (Lane)",hint:"Bấm vị trí đầu và cuối để vẽ đoạn ngang; chọn Lane rồi kéo cả đoạn hoặc hai đầu mút."},
 {id:"connector",icon:"╱",label:"Nối đường",hint:"Bấm lần lượt gần hai Lane khác nhau để nối tuyến; chọn Connector để chỉnh từng đầu bằng kéo hoặc tọa độ."},
 {id:"checkpoint",icon:"◆",label:"Checkpoint",hint:"Bấm vào một Lane gần nhất để đặt checkpoint. Tọa độ tự snap vào tuyến."},
 {id:"area",icon:"▧",label:"Khu vực",hint:"Bấm từng đỉnh để vẽ đa giác; bấm lại đỉnh đầu hoặc Hoàn tất đa giác. Dùng Chọn để kéo/chèn/xóa đỉnh."},
 {id:"pin",icon:"✳",label:"Điểm xuất hiện",hint:"Bấm gần một Lane để đặt pin xuất hiện, không đổi trạng thái Presence thật."}
];
// PAP-1417 / PNR-TV: Founder-requested guide to the PURPOSE of each House Mesh tool.
// Descriptions are intentionally scoped to prototype behavior; no runtime pathfinding or Presence contract implied.
const houseFunctionGuide=[
 {icon:"✳",name:"Điểm xuất hiện · Emergence",purpose:"Vị trí một Piner bắt đầu xuất hiện trong House; đây là điểm khởi đầu, không phải điểm dừng hay Checkpoint.",how:"Đặt gần Lane để ghim và chọn lại để đổi Lane/X trong Thuộc tính. Chỉ là marker thiết kế, không check-in hoặc tạo Presence thật."},
 {icon:"━",name:"Đường đi · Lane",purpose:"Tuyến di chuyển cơ bản của Piner trên hình House; quyết định đoạn chạy và độ sâu trước/sau lớp HouseMid.",how:"Bấm hai điểm để xác định chiều dài (tối thiểu 72px). Chọn Lane để kéo cả đoạn theo X/Y, kéo đầu mút hoặc chỉnh X1/X2/Y trong Thuộc tính."},
 {icon:"╱",name:"Nối đường · Connector",purpose:"Đường liên kết hai tuyến Lane để mô tả nơi Piner có thể chuyển từ tuyến này sang tuyến khác.",how:"Bấm điểm gần Lane nguồn, sau đó bấm Lane đích khác (trong khoảng 120px). Có thể kéo đầu A/B, sửa X/Y; kiểm tra trạng thái kết nối bên dưới canvas."},
 {icon:"▧",name:"Khu vực · Area",purpose:"Khoanh vùng trên bản đồ House, ví dụ sảnh hoặc khu hoạt động, để người thiết kế dễ nhận diện không gian.",how:"Bấm từng đỉnh rồi Hoàn tất đa giác. Với vùng hiện hữu: chọn vùng, kéo từng đỉnh, bấm cạnh để chèn đỉnh, chọn đỉnh rồi Delete để xóa; giữ ít nhất 3 đỉnh."},
 {icon:"◆",name:"Checkpoint · Điểm kiểm soát",purpose:"Mốc tham chiếu trên Lane để phác thảo điểm đến hoặc điểm dừng của hành trình; không làm Piner xuất hiện.",how:"Đặt gần Lane để tự căn vào tuyến; chọn lại trong danh sách đối tượng để đổi Lane hoặc nhập tọa độ X. Chưa gắn hành vi nghiệp vụ thật."},
 {icon:"↖",name:"Chọn / Di chuyển",purpose:"Chọn một đối tượng có sẵn để thay đổi vị trí, độ sâu hoặc thuộc tính và kiểm tra lại bố cục.",how:"Bấm hoặc kéo đối tượng trên House; mở Thuộc tính để nhập tọa độ, Undo để hoàn tác."}
] as const;
export function HoTvSpaceMeshDraft({record}:{record:HoTvSpaceRecord}){
 const [mesh,setMesh]=useState<Mesh>(seedMesh);
 const [tool,setTool]=useState<Tool>("select");
 const [selected,setSelected]=useState<Pick|null>(null);
 const [inspectorOpen,setInspectorOpen]=useState(false);
 const [visibility,setVisibility]=useState<Visibility>({back:true,mid:true,front:true,lanes:true,connectors:true,areas:true,pins:true,checkpoints:true,grid:false});
 const [anchor,setAnchor]=useState<Point|null>(null);
 const [areaDraft,setAreaDraft]=useState<Point[]>([]);
 const [cursorPoint,setCursorPoint]=useState<Point|null>(null);
 const [selectedAreaVertex,setSelectedAreaVertex]=useState<number|null>(null);
 const [preview,setPreview]=useState(false);
 const [agents,setAgents]=useState<AmbientAgent[]>([]);
 const [note,setNote]=useState("Đã nạp mesh 1920×1080 từ nguồn approved; thay đổi chỉ ở trình duyệt.");
 const [dirty,setDirty]=useState(false);
 const [snapOn,setSnapOn]=useState(true);
 const [ratio,setRatio]=useState(1);
 const [origin,setOrigin]=useState<Point>({x:0,y:0});
 const [loaded,setLoaded]=useState<Record<string,boolean>>({});
 const svg=useRef<SVGSVGElement>(null);
 const history=useRef<Mesh[]>([]);
 const [undoDepth,setUndoDepth]=useState(0);
 const drag=useRef<{pick:Pick;from:Point;original:Mesh;changed:boolean;vertexIndex?:number;laneEnd?:"x1"|"x2";connectorEnd?:"from"|"to"}|null>(null);
 const pan=useRef<{clientX:number;clientY:number;original:Point}|null>(null);
 const pickValue=selected?.kind==="lane"?mesh.lanes.find(v=>v.id===selected.id)
 :selected?.kind==="connector"?mesh.connectors.find(v=>v.id===selected.id)
 :selected?.kind==="area"?mesh.areas.find(v=>v.id===selected.id)
 :selected?.kind==="pin"?mesh.pins.find(v=>v.id===selected.id)
 :selected?.kind==="checkpoint"?mesh.checkpoints.find(v=>v.id===selected.id):null;
 const graph=useMemo<AmbientMotionGraph>(()=>({canvas:WORLD,miniCharacter:{width:164,height:115},horizontalLanes:mesh.lanes,rawConnectors:mesh.connectors}),[mesh]);
 const resolvedConnectors=useMemo(()=>resolveAmbientConnectors(graph),[graph]);
 const issueList=useMemo(()=>{
  const issues:string[]=[];
  for(const lane of mesh.lanes)if(lane.x1<0||lane.x2>1920||lane.x2-lane.x1<72||lane.y<0||lane.y>1080)issues.push(lane.id+" ngoài canvas hoặc ngắn hơn 72px");
  for(const pin of [...mesh.pins,...mesh.checkpoints])if(!mesh.lanes.some(l=>l.id===pin.laneId&&pin.x>=l.x1+36&&pin.x<=l.x2-36&&Math.abs(pin.y-l.y)<1))issues.push(pin.id+" chưa nằm trên vùng an toàn của Lane");
  for(const area of mesh.areas)if(!isValidPolygon(area.points))issues.push(area.id+" có đa giác không hợp lệ, tự cắt hoặc thiếu đỉnh");
  const resolved=new Set(resolvedConnectors.map(c=>c.id));
  for(const connector of mesh.connectors)if(!resolved.has(connector.id))issues.push(connector.id+" không kết nối được hai Lane khác nhau trong bán kính 120px");
  return issues;
 },[mesh,resolvedConnectors]);
 useEffect(()=>{if(!preview||issueList.length)return;
  const id=window.setInterval(()=>setAgents(previous=>stepAmbientAgents(previous,graph,68)),68);
  return()=>window.clearInterval(id);
 },[preview,issueList.length,graph]);
 useEffect(()=>{let alive=true;for(const key of ["back","mid","front"] as const){const image=new window.Image();image.onload=()=>{if(alive)setLoaded(v=>({...v,[key]:true}));};image.onerror=()=>{if(alive)setLoaded(v=>({...v,[key]:false}));};image.src=HOUSE[key];}return()=>{alive=false};},[]);
 const commit=(fn:(draft:Mesh)=>void,message:string)=>{
  history.current.push(structuredClone(mesh));setUndoDepth(history.current.length);
  const next=structuredClone(mesh);fn(next);setMesh(next);setDirty(true);setPreview(false);setNote(message);
 };
 const point=(e:ReactPointerEvent<SVGSVGElement>):Point=>{
  const el=svg.current,ctm=el?.getScreenCTM();if(!ctm)return{x:0,y:0};
  const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse());
  return{x:clamp(snapOn?snap(pt.x,10):Math.round(pt.x),0,1920),y:clamp(snapOn?snap(pt.y,10):Math.round(pt.y),0,1080)};
 };
 const laneDistance=(lane:Lane,p:Point)=>Math.hypot(p.x<lane.x1?lane.x1-p.x:p.x>lane.x2?p.x-lane.x2:0,p.y-lane.y);
 const nearestLane=(p:Point)=>[...mesh.lanes].sort((a,b)=>laneDistance(a,p)-laneDistance(b,p))[0];
 const snappedLanePoint=(p:Point,maxDistance:number)=>{
  const lane=nearestLane(p);
  return lane&&laneDistance(lane,p)<=maxDistance&&lane.x2-lane.x1>=72
   ?{point:{x:clamp(p.x,lane.x1+36,lane.x2-36),y:lane.y},laneId:lane.id}:null;
 };
 const startPreview=()=>{
  if(issueList.length)return;
  if(preview){setPreview(false);return;}
  const ids=Array.from({length:20},(_,i)=>"preview-"+String(i+1).padStart(2,"0"));
  try{setAgents(createAmbientAgents(ids,graph));setPreview(true);setNote("20 Piner giả lập chạy theo hàm PAP-651: Lane, Connector, khoảng cách; không có Presence thật.");}
  catch{setNote("Không đủ sức chứa hoặc hình học hợp lệ để tạo 20 Piner mô phỏng.");setPreview(false);}
 };
 const update=(fn:(draft:Mesh)=>void,message="Đã cập nhật bản nháp.")=>commit(fn,message);
 const finishAreaDraft=()=>{
  if(!isValidPolygon(areaDraft)){setNote("Cần tối thiểu 3 đỉnh tạo thành đa giác không tự cắt và nằm trong canvas 1920×1080.");return;}
  const id=newId("area",mesh.areas);
  commit(d=>d.areas.push({id,label:"Khu vực mới "+(mesh.areas.length+1),points:areaDraft.map(p=>({...p}))}),"Đã tạo đa giác "+id+" với "+areaDraft.length+" đỉnh (chỉ là bản nháp).");
  setAreaDraft([]);setTool("select");setSelected({kind:"area",id});setSelectedAreaVertex(null);setInspectorOpen(true);
 };
 const onDown=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(e.button!==0)return;
  const p=point(e),el=e.target as Element,rawKind=el.getAttribute("data-kind"),id=el.getAttribute("data-id");
  const kind=(["lane","connector","area","pin","checkpoint"].includes(rawKind??"")?rawKind:null) as Kind|null;
  if(tool==="select"){
   if(rawKind==="lane-endpoint"&&id){
    const end=el.getAttribute("data-end");
    if(end!=="x1"&&end!=="x2")return;
    setSelected({kind:"lane",id});setSelectedAreaVertex(null);setInspectorOpen(true);
    drag.current={pick:{kind:"lane",id},from:p,original:structuredClone(mesh),changed:false,laneEnd:end};
    e.currentTarget.setPointerCapture(e.pointerId);return;
   }
   if(rawKind==="connector-endpoint"&&id){
    const end=el.getAttribute("data-end");
    if(end!=="from"&&end!=="to")return;
    setSelected({kind:"connector",id});setSelectedAreaVertex(null);setInspectorOpen(true);
    drag.current={pick:{kind:"connector",id},from:p,original:structuredClone(mesh),changed:false,connectorEnd:end};
    e.currentTarget.setPointerCapture(e.pointerId);return;
   }
   if(rawKind==="area-vertex"&&id){
    const index=Number(el.getAttribute("data-index")),area=mesh.areas.find(a=>a.id===id);
    if(!area||!Number.isInteger(index)||index<0||index>=area.points.length)return;
    setSelected({kind:"area",id});setSelectedAreaVertex(index);setInspectorOpen(true);
    drag.current={pick:{kind:"area",id},from:p,original:structuredClone(mesh),changed:false,vertexIndex:index};
    e.currentTarget.setPointerCapture(e.pointerId);return;
   }
   if(rawKind==="area-edge"&&id){
    const index=Number(el.getAttribute("data-index")),area=mesh.areas.find(a=>a.id===id);
    if(!area||!Number.isInteger(index)||index<0||index>=area.points.length)return;
    const a=area.points[index],b=area.points[(index+1)%area.points.length],dx=b.x-a.x,dy=b.y-a.y;
    const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1,dx*dx+dy*dy),.02,.98);
    const vertex={x:clamp(snapOn?snap(a.x+dx*t,10):Math.round(a.x+dx*t),0,1920),y:clamp(snapOn?snap(a.y+dy*t,10):Math.round(a.y+dy*t),0,1080)};
    commit(d=>{const target=d.areas.find(x=>x.id===id);if(target)target.points.splice(index+1,0,vertex);},"Đã chèn đỉnh "+(index+2)+" vào cạnh vùng "+id+".");
    setSelected({kind:"area",id});setSelectedAreaVertex(index+1);setInspectorOpen(true);return;
   }
   if(kind&&id){
    const pick={kind,id};setSelected(pick);setSelectedAreaVertex(null);setInspectorOpen(true);
    drag.current={pick,from:p,original:structuredClone(mesh),changed:false};e.currentTarget.setPointerCapture(e.pointerId);
   }else {setSelectedAreaVertex(null);pan.current={clientX:e.clientX,clientY:e.clientY,original:{...origin}};e.currentTarget.setPointerCapture(e.pointerId);}
   return;
  }
  if(tool==="area"){
   if(el.getAttribute("data-area-draft-close")==="true"&&areaDraft.length>=3){finishAreaDraft();return;}
   if(areaDraft.length&&Math.abs(areaDraft[areaDraft.length-1].x-p.x)+Math.abs(areaDraft[areaDraft.length-1].y-p.y)<8){setNote("Điểm mới trùng điểm vừa chọn; chọn vị trí khác.");return;}
   setAreaDraft(points=>[...points,p]);setNote("Đã đặt đỉnh "+(areaDraft.length+1)+". Bấm tiếp để vẽ; chọn đỉnh đầu hoặc Hoàn tất đa giác để đóng.");return;
  }
  if(tool==="lane"){
   if(!anchor){setAnchor(p);setCursorPoint(p);setNote("Đã chọn đầu Lane. Bấm điểm thứ hai để xác định chiều dài (tối thiểu 72px).");return;}
   const x1=Math.min(anchor.x,p.x),x2=Math.max(anchor.x,p.x);
   if(x2-x1<72){setNote("Lane phải dài tối thiểu 72px; chọn điểm cuối xa hơn.");return;}
   const id=newId("lane",mesh.lanes);
   commit(d=>d.lanes.push({id,x1,x2,y:anchor.y,midLayer:"front"}),"Đã tạo Lane "+id+" dài "+Math.round(x2-x1)+"px.");
   setAnchor(null);setCursorPoint(null);setTool("select");setSelected({kind:"lane",id});setSelectedAreaVertex(null);setInspectorOpen(true);return;
  }
  if(tool==="connector"){
   const attached=snappedLanePoint(p,120);
   if(!attached){setNote("Chọn điểm gần Lane (không quá 120px) để tạo Connector hợp lệ.");return;}
   if(!anchor){setAnchor(attached.point);setCursorPoint(attached.point);setNote("Đã chọn Lane nguồn "+attached.laneId+". Chọn điểm trên Lane khác để nối.");return;}
   const source=snappedLanePoint(anchor,120);
   if(!source||source.laneId===attached.laneId){setNote("Connector phải nối hai Lane khác nhau; chọn Lane đích khác.");return;}
   const id=newId("connector",mesh.connectors);
   commit(d=>d.connectors.push({id,from:source.point,to:attached.point}),"Đã nối "+source.laneId+" → "+attached.laneId+" bằng "+id+".");
   setAnchor(null);setCursorPoint(null);setTool("select");setSelected({kind:"connector",id});setSelectedAreaVertex(null);setInspectorOpen(true);return;
  }
  if(tool==="checkpoint"||tool==="pin"){
   const attached=snappedLanePoint(p,80);if(!attached){setNote("Chọn gần Lane trong khoảng 80px (và cách đầu Lane ít nhất 36px).");return;}
   const lane=mesh.lanes.find(l=>l.id===attached.laneId)!;
   const x=attached.point.x;
   if(tool==="checkpoint"){const id=newId("cp",mesh.checkpoints);commit(d=>d.checkpoints.push({id,label:"Checkpoint mới",laneId:lane.id,x,y:lane.y}),"Đã thêm điểm kiểm soát trên "+lane.id+".");setSelected({kind:"checkpoint",id});setInspectorOpen(true);}
   else {const id=newId("emergence",mesh.pins);commit(d=>d.pins.push({id,laneId:lane.id,x,y:lane.y}),"Đã thêm emergence pin local; không ảnh hưởng TV thật.");setSelected({kind:"pin",id});setInspectorOpen(true);}
   setSelectedAreaVertex(null);
  }
 };
 const onMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(anchor)setCursorPoint(point(e));
  if(!drag.current&&!pan.current)return;const p=point(e);
  if(pan.current){
   const rect=svg.current?.getBoundingClientRect();if(!rect)return;
   const dx=(e.clientX-pan.current.clientX)/Math.max(rect.width,1)*(1920/ratio);
   const dy=(e.clientY-pan.current.clientY)/Math.max(rect.height,1)*(1080/ratio);
   setOrigin({x:clamp(pan.current.original.x-dx,0,1920-1920/ratio),y:clamp(pan.current.original.y-dy,0,1080-1080/ratio)});return;
  }
  const state=drag.current!;const dx=p.x-state.from.x,dy=p.y-state.from.y;
  if(Math.abs(dx)+Math.abs(dy)<1)return;state.changed=true;
  const next=structuredClone(state.original),pick=state.pick;
  if(pick.kind==="lane"){const lane=next.lanes.find(l=>l.id===pick.id);if(lane){
   if(state.laneEnd==="x1")lane.x1=clamp(lane.x1+dx,0,lane.x2-72);
   else if(state.laneEnd==="x2")lane.x2=clamp(lane.x2+dx,lane.x1+72,1920);
   else{
    const dxSafe=clamp(dx,-lane.x1,1920-lane.x2);
    lane.x1+=dxSafe;lane.x2+=dxSafe;lane.y=clamp(lane.y+dy,0,1080);
    for(const pin of [...next.pins,...next.checkpoints])if(pin.laneId===lane.id){pin.x=clamp(pin.x+dxSafe,lane.x1+36,lane.x2-36);pin.y=lane.y;}
   }
  }}
  if(pick.kind==="checkpoint"||pick.kind==="pin"){
   const pin=(pick.kind==="pin"?next.pins:next.checkpoints).find(x=>x.id===pick.id);
   const lane=next.lanes.find(l=>l.id===pin?.laneId);
   if(pin&&lane){pin.x=clamp(pin.x+dx,lane.x1,lane.x2);pin.y=lane.y;}
  }
  if(pick.kind==="area"){const area=next.areas.find(a=>a.id===pick.id);if(area){
   if(state.vertexIndex!==undefined){
    const vertex=area.points[state.vertexIndex];
    if(vertex){vertex.x=clamp(vertex.x+dx,0,1920);vertex.y=clamp(vertex.y+dy,0,1080);}
   }else{
    const b=bounds(area.points);const ax=clamp(dx,-b.x,1920-b.x-b.w),ay=clamp(dy,-b.y,1080-b.y-b.h);
    area.points=area.points.map(q=>({x:q.x+ax,y:q.y+ay}));
   }
  }}
  if(pick.kind==="connector"){const c=next.connectors.find(c=>c.id===pick.id);if(c){
   if(state.connectorEnd==="from")c.from={x:clamp(c.from.x+dx,0,1920),y:clamp(c.from.y+dy,0,1080)};
   else if(state.connectorEnd==="to")c.to={x:clamp(c.to.x+dx,0,1920),y:clamp(c.to.y+dy,0,1080)};
   else{const points=[c.from,c.to];const dxSafe=clamp(dx,-Math.min(...points.map(v=>v.x)),1920-Math.max(...points.map(v=>v.x))),dySafe=clamp(dy,-Math.min(...points.map(v=>v.y)),1080-Math.max(...points.map(v=>v.y)));
    c.from={x:c.from.x+dxSafe,y:c.from.y+dySafe};c.to={x:c.to.x+dxSafe,y:c.to.y+dySafe};}
  }}
  setPreview(false);setMesh(next);setDirty(true);
 };
 const onUp=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(drag.current?.changed){history.current.push(drag.current.original);setUndoDepth(history.current.length);setNote("Đã kéo "+drag.current.pick.id+" theo tọa độ 1920×1080; Undo để hoàn tác.");}
  drag.current=null;pan.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const undo=()=>{setPreview(false);if(areaDraft.length){setAreaDraft(points=>points.slice(0,-1));setNote("Đã bỏ đỉnh cuối đang vẽ.");return;}const past=history.current.pop();if(!past)return;setUndoDepth(history.current.length);setMesh(past);setSelected(null);setSelectedAreaVertex(null);setInspectorOpen(false);setNote("Đã hoàn tác thao tác cuối.");setDirty(JSON.stringify(past)!==JSON.stringify(seedMesh()));};
 const reset=()=>{history.current.push(structuredClone(mesh));setUndoDepth(history.current.length);setMesh(seedMesh());setSelected(null);setSelectedAreaVertex(null);setAreaDraft([]);setTool("select");setInspectorOpen(false);setAnchor(null);setPreview(false);setAgents([]);setDirty(false);setNote("Đã khôi phục bố cục ban đầu.");};
 const setLayer=(key:keyof Visibility)=>setVisibility(v=>({...v,[key]:!v[key]}));
 const changeNumber=(field:string,value:number)=>{
  if(!selected||!Number.isFinite(value))return;
  update(d=>{
   if(selected.kind==="lane"){const l=d.lanes.find(x=>x.id===selected.id);if(!l)return;
    if(field==="x1")l.x1=clamp(value,0,l.x2-72);if(field==="x2")l.x2=clamp(value,l.x1+72,1920);if(field==="y"){l.y=clamp(value,0,1080);[...d.pins,...d.checkpoints].filter(x=>x.laneId===l.id).forEach(x=>x.y=l.y);}
   }else if(selected.kind==="pin"||selected.kind==="checkpoint"){const p=(selected.kind==="pin"?d.pins:d.checkpoints).find(x=>x.id===selected.id),l=d.lanes.find(x=>x.id===p?.laneId);if(p&&l&&field==="x")p.x=clamp(value,l.x1+36,l.x2-36);}
   else if(selected.kind==="connector"){
    const c=d.connectors.find(x=>x.id===selected.id);if(!c)return;
    if(field==="fromX")c.from.x=clamp(Math.round(value),0,1920);
    if(field==="fromY")c.from.y=clamp(Math.round(value),0,1080);
    if(field==="toX")c.to.x=clamp(Math.round(value),0,1920);
    if(field==="toY")c.to.y=clamp(Math.round(value),0,1080);
   }
   else if(selected.kind==="area"&&selectedAreaVertex!==null){
    const area=d.areas.find(a=>a.id===selected.id),vertex=area?.points[selectedAreaVertex];
    if(vertex){if(field==="vertexX")vertex.x=clamp(Math.round(value),0,1920);if(field==="vertexY")vertex.y=clamp(Math.round(value),0,1080);}
   }
  });
 };
 const del=()=>{if(!selected)return;const item=selected;
  if(item.kind==="area"&&selectedAreaVertex!==null){
   const area=mesh.areas.find(a=>a.id===item.id);
   if(!area||area.points.length<=3){setNote("Một khu vực phải có ít nhất 3 đỉnh; không thể xóa thêm.");return;}
   const index=selectedAreaVertex;
   update(d=>{const target=d.areas.find(a=>a.id===item.id);if(target)target.points.splice(index,1);},"Đã xóa đỉnh "+(index+1)+" của "+item.id+".");
   setSelectedAreaVertex(null);return;
  }
  update(d=>{if(item.kind==="lane"){d.lanes=d.lanes.filter(x=>x.id!==item.id);d.pins=d.pins.filter(x=>x.laneId!==item.id);d.checkpoints=d.checkpoints.filter(x=>x.laneId!==item.id);}
   if(item.kind==="connector")d.connectors=d.connectors.filter(x=>x.id!==item.id);
   if(item.kind==="area")d.areas=d.areas.filter(x=>x.id!==item.id);
   if(item.kind==="pin")d.pins=d.pins.filter(x=>x.id!==item.id);
   if(item.kind==="checkpoint")d.checkpoints=d.checkpoints.filter(x=>x.id!==item.id);
  },"Đã xóa "+item.id+" khỏi bản nháp.");setSelected(null);setInspectorOpen(false);};
 const renderPreviewActor=(actor:AmbientAgent)=><g key={actor.id} data-preview-agent={actor.id} data-depth={actor.depth} pointerEvents="none">
  <circle cx={actor.x} cy={actor.y-14} r="18" stroke="#fff" strokeWidth="5" fill="#547d98"/>
  <text x={actor.x} y={actor.y-9} textAnchor="middle" fontSize="14" fill="#fff">{actor.id.slice(-2)}</text>
 </g>;
 const onShortcut=(event:ReactKeyboardEvent<HTMLElement>)=>{
  const target=event.target as HTMLElement;
  if(target.matches("input,textarea,select,[contenteditable='true']"))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();undo();return;}
  if(event.key==="Escape"){event.preventDefault();setAreaDraft([]);setSelectedAreaVertex(null);setAnchor(null);setCursorPoint(null);setTool("select");setInspectorOpen(false);setNote("Đã hủy thao tác vẽ/chọn.");return;}
  if(event.key==="Enter"&&tool==="area"){event.preventDefault();finishAreaDraft();return;}
  if(event.key==="Delete"&&selected){event.preventDefault();del();return;}
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(event.key.toLowerCase()==="z"){event.preventDefault();undo();return;}
  const shortcuts:Record<string,Tool>={v:"select",l:"lane",c:"connector",k:"checkpoint",a:"area",p:"pin"};
  const active=shortcuts[event.key.toLowerCase()];
  if(active){event.preventDefault();setTool(active);setAreaDraft([]);setCursorPoint(null);setSelectedAreaVertex(null);setAnchor(null);setNote(tools.find(x=>x.id===active)?.hint??"");}
 };
 return <SpatialEditorFrame label="Biên tập không gian House Mesh"><section className="ho-tv-domain ho-house-mesh" data-house-mesh-northstar tabIndex={0} onKeyDown={onShortcut}>
  <header className="ho-tv-domain-heading"><div><span className="ho-tv-eyebrow">PINORIA TV · AMBIENT WELCOME · 1920 × 1080</span><h2>House Mesh</h2><p>Chỉnh đường đi, nối tuyến, vùng hoạt động và checkpoint trực tiếp trên đúng ảnh House đã duyệt.</p></div><span className="ho-tv-scope-pill is-default">{String(record.scope??"DEFAULT")}</span></header>
  <div className="house-metrics"><div><strong>{mesh.lanes.length}</strong><small>Đường đi · Lanes</small></div><div><strong>{mesh.connectors.length}</strong><small>Nối tuyến · Connectors</small></div><div><strong>{mesh.areas.length}</strong><small>Khu vực · Areas</small></div><div><strong>{mesh.checkpoints.length}</strong><small>Điểm kiểm soát</small></div><div><strong>{mesh.pins.length}</strong><small>Điểm xuất hiện</small></div></div>
  <div className="house-area-existing" role="group" aria-label="Chọn khu vực hiện hữu">
   <strong>Khu vực hiện hữu</strong>
   {mesh.areas.map(area=><button key={area.id} type="button" aria-pressed={selected?.kind==="area"&&selected.id===area.id}
    onClick={()=>{setTool("select");setAreaDraft([]);setSelected({kind:"area",id:area.id});setSelectedAreaVertex(null);setInspectorOpen(true);setNote("Đang chỉnh "+area.label+". Chọn hoặc kéo đỉnh, bấm cạnh để chèn đỉnh.");}}>
    {area.label} <small>{area.points.length} đỉnh</small>
   </button>)}
  </div>
  <label className="house-object-picker">Chọn đối tượng theo ID
   <select aria-label="Chọn đối tượng House Mesh" value={selected?selected.kind+":"+selected.id:""} onChange={e=>{
    const [kind,id]=e.target.value.split(":") as [Kind,string];if(!kind||!id){setSelected(null);setInspectorOpen(false);return;}
    setTool("select");setAnchor(null);setCursorPoint(null);setAreaDraft([]);setSelectedAreaVertex(null);setSelected({kind,id});setInspectorOpen(true);
    setNote("Đang chỉnh "+id+" trên House Mesh.");
   }}>
    <option value="">— Chọn một đối tượng —</option>
    {([["Đường đi","lane",mesh.lanes],["Nối đường","connector",mesh.connectors],["Checkpoint","checkpoint",mesh.checkpoints],["Điểm xuất hiện","pin",mesh.pins]] as const).map(([label,kind,items])=>
     <optgroup key={kind} label={label}>{items.map(item=><option key={item.id} value={kind+":"+item.id}>{item.id}</option>)}</optgroup>)}
   </select>
  </label>
  <div className="house-tooltop"><div className="house-tool-buttons">
    <button type="button" className="secondary-btn" disabled={!undoDepth&&!areaDraft.length} onClick={undo}>↶ Undo</button>
    <button type="button" className="secondary-btn" onClick={reset}>Khôi phục bố cục</button>
    <button type="button" className="secondary-btn" disabled={!!issueList.length} onClick={startPreview}>{preview?"■ Dừng mô phỏng":"▶ Chạy thử 20 Piner"}</button>
   </div><div className="house-edit-status" role="status">{dirty?"Có thay đổi chưa lưu":"Đang xem bố cục"} · {issueList.length?issueList.length+" lỗi bố cục":"Bố cục hợp lệ"}</div></div>
  {tool==="area"&&<div className="house-area-draw-controls" role="group" aria-label="Vẽ đa giác Khu vực">
   <span><strong>Vẽ đa giác</strong> · {areaDraft.length} đỉnh · Bấm từng điểm trên House; bấm lại đỉnh đầu để đóng.</span>
   <div><button type="button" className="secondary-btn" onClick={finishAreaDraft} disabled={!isValidPolygon(areaDraft)}>✓ Hoàn tất đa giác</button>
    <button type="button" className="secondary-btn" disabled={!areaDraft.length} onClick={()=>{setAreaDraft([]);setNote("Đã hủy đa giác đang vẽ.");}}>Hủy vẽ</button></div>
  </div>}
  {anchor&&(tool==="lane"||tool==="connector")&&<div className="house-draw-tip" role="status">
   Đang đặt điểm đầu ({anchor.x}, {anchor.y}) · Bấm điểm thứ hai để hoàn tất {tool==="lane"?"Lane ngang":"Connector nối hai Lane khác nhau"}.
   <button type="button" onClick={()=>{setAnchor(null);setCursorPoint(null);}}>Hủy điểm đầu</button>
  </div>}
  <div className={"house-workbench"+(inspectorOpen?" with-inspector":"")}>
   <div className="house-side house-config-bar" role="toolbar" aria-label="Công cụ chỉnh sửa House Mesh">
    <div className="house-quick-tools">
     {tools.map((item,i)=><button key={item.id} type="button" aria-pressed={tool===item.id} className={tool===item.id?"active":""} title={item.hint} aria-keyshortcuts={["V","L","C","K","A","P"][i]} onClick={()=>{setTool(item.id);setAreaDraft([]);setSelectedAreaVertex(null);setAnchor(null);setCursorPoint(null);setNote(item.hint);}}>
      <span className="house-tool-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
     </button>)}
    </div>
    <div className="house-config-options">
     <label className="house-toggleline" title="Căn lưới khi thêm hoặc kéo đối tượng"><input type="checkbox" checked={snapOn} onChange={e=>setSnapOn(e.target.checked)}/> Snap 10px</label>
     <details className="house-layer-details"><summary>▤ Layers <span aria-hidden="true">⌄</span></summary>
      <div className="house-layer-popover"><strong>Hiển thị trên House</strong>
       <div className="house-layer-list">
        {([["back","HouseBack · Nền"],["mid","HouseMid · Chiều sâu"],["front","HouseFront · Mặt tiền"],["areas","Areas"],["lanes","Lanes"],["connectors","Connectors"],["checkpoints","Checkpoints"],["pins","Emergence"],["grid","Lưới 50 px"]] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={visibility[key]} onChange={()=>setLayer(key)}/><span>{label}</span></label>)}
       </div><p>Chỉ thay đổi preview, không lưu Core.</p>
      </div>
     </details>
    </div>
   </div>
   <div className="house-stage">
    <div className="house-stage-header"><div><strong>House · Bản thiết kế đường đi</strong><span>1920×1080 · PINO House</span></div><div className="house-stage-controls"><button type="button" onClick={()=>{setRatio(1);setOrigin({x:0,y:0});}} title="Vừa khung 100%">⤢ Fit</button><label>Zoom <input type="range" min="1" max="2.5" step=".25" value={ratio} onChange={e=>{const v=Number(e.target.value);setRatio(v);setOrigin({x:0,y:0});}}/> {Math.round(ratio*100)}%</label><button type="button" className={inspectorOpen?"active":""} aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(v=>!v)}>⚙ Thuộc tính{selected?" · "+selected.id:""}</button></div></div>
    <div className="house-stage-canvas" data-house-background={loaded.back?"loaded":"pending"}>
     <svg ref={svg} viewBox={origin.x+" "+origin.y+" "+1920/ratio+" "+1080/ratio} preserveAspectRatio="xMidYMid meet" aria-label="Approved Pinoria House image and editable movement mesh" role="img" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <defs><pattern id="pino-house-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#fff" strokeOpacity=".36" strokeWidth="1"/></pattern></defs>
      <rect width="1920" height="1080" fill="#42586a" pointerEvents="none"/>
      {visibility.back&&<image href={HOUSE.back} x="0" y="0" width="1920" height="1080" preserveAspectRatio="none" pointerEvents="none" onLoad={()=>setLoaded(v=>({...v,back:true}))} onError={()=>setLoaded(v=>({...v,back:false}))}/>}
      {preview&&agents.filter(actor=>actor.depth==="behind").map(renderPreviewActor)}
      {visibility.mid&&<image href={HOUSE.mid} x="0" y="0" width="1920" height="1080" preserveAspectRatio="none" pointerEvents="none" onLoad={()=>setLoaded(v=>({...v,mid:true}))} onError={()=>setLoaded(v=>({...v,mid:false}))}/>}
      {preview&&agents.filter(actor=>actor.depth==="front").map(renderPreviewActor)}
      {visibility.front&&<image href={HOUSE.front} x="0" y="0" width="1920" height="1080" preserveAspectRatio="none" pointerEvents="none" onLoad={()=>setLoaded(v=>({...v,front:true}))} onError={()=>setLoaded(v=>({...v,front:false}))}/>}
      {visibility.grid&&<rect width="1920" height="1080" fill="url(#pino-house-grid)" pointerEvents="none"/>}
      {visibility.areas&&mesh.areas.map(a=>{const box=bounds(a.points);return <g key={a.id}>
       <polygon data-kind="area" data-id={a.id} points={poly(a.points)} fill="#23a6a1" fillOpacity=".16" stroke={selected?.id===a.id?"#fff2a6":"#4bd6c4"} strokeWidth="5" strokeDasharray="15 9"/>
       <g pointerEvents="none"><rect x={box.x+8} y={box.y+8} width={Math.min(245,box.w-12)} height="40" rx="8" fill="#1d3448" fillOpacity=".88"/><text x={box.x+22} y={box.y+36} fontSize="24" fontWeight="700" fill="#fff">{a.label}</text></g>
      </g>})}
      {visibility.connectors&&mesh.connectors.map(c=><g key={c.id}><line data-kind="connector" data-id={c.id} x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke="#1e3047" strokeWidth="16" strokeOpacity=".7"/><line data-kind="connector" data-id={c.id} x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke={selected?.id===c.id?"#fff0a5":"#ffc875"} strokeWidth="8" strokeDasharray="14 11"/></g>)}
      {visibility.lanes&&mesh.lanes.map(l=><g key={l.id}>
       <line data-kind="lane" data-id={l.id} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} stroke="#1d3448" strokeWidth="19" strokeOpacity=".8" strokeLinecap="round"/>
       <line data-kind="lane" data-id={l.id} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} stroke={selected?.id===l.id?"#fff7a7":l.midLayer==="behind"?"#91a9f8":"#8be6b9"} strokeWidth={selected?.id===l.id?11:8} strokeLinecap="round"/>
       <text x={l.x1+12} y={l.y-18} fontSize="22" fontWeight="700" paintOrder="stroke" stroke="#203c4a" strokeWidth="7" fill="#fff" pointerEvents="none">{l.id}</text>
      </g>)}
      {tool==="select"&&visibility.lanes&&selected?.kind==="lane"&&mesh.lanes.filter(l=>l.id===selected.id).map(l=><g key={"lane-handles-"+l.id}>
       {(["x1","x2"] as const).map(end=><circle key={end} data-kind="lane-endpoint" data-id={l.id} data-end={end}
        cx={l[end]} cy={l.y} r="21" fill="#f6e9a6" stroke="#385e76" strokeWidth="5"/>)}
      </g>)}
      {tool==="select"&&visibility.connectors&&selected?.kind==="connector"&&mesh.connectors.filter(c=>c.id===selected.id).map(c=><g key={"conn-handles-"+c.id}>
       {(["from","to"] as const).map(end=><circle key={end} data-kind="connector-endpoint" data-id={c.id} data-end={end}
        cx={c[end].x} cy={c[end].y} r="22" fill={end==="from"?"#d3f3d5":"#ffddaf"} stroke="#385e76" strokeWidth="5"/>)}
      </g>)}
      {visibility.pins&&mesh.pins.map(p=><g key={p.id} data-kind="pin" data-id={p.id}><circle data-kind="pin" data-id={p.id} cx={p.x} cy={p.y} r="24" fill="#e38ab6" stroke="#fff" strokeWidth="7"/><path data-kind="pin" data-id={p.id} d={"M"+p.x+" "+(p.y-12)+"v24 M"+(p.x-12)+" "+p.y+"h24"} stroke="#fff" strokeWidth="4"/><text x={p.x+32} y={p.y-28} fill="#fff" fontSize="25" fontWeight="800" paintOrder="stroke" stroke="#203c4a" strokeWidth="6" pointerEvents="none">Entry / Emergence</text></g>)}
      {visibility.checkpoints&&mesh.checkpoints.map((p,i)=><g key={p.id} data-kind="checkpoint" data-id={p.id}>
       <rect data-kind="checkpoint" data-id={p.id} x={p.x-19} y={p.y-19} width="38" height="38" rx="9" transform={"rotate(45 "+p.x+" "+p.y+")"} fill={selected?.id===p.id?"#ffea96":"#d8b26b"} stroke="#fff" strokeWidth="5"/>
       <text x={p.x} y={p.y+8} fill="#20394c" fontSize="20" fontWeight="900" textAnchor="middle" pointerEvents="none">{i+1}</text>
       <text x={p.x+32} y={p.y+43} fill="#fff" fontSize="22" fontWeight="700" paintOrder="stroke" stroke="#213b4a" strokeWidth="6" pointerEvents="none">{p.label}</text>
      </g>)}
      {visibility.areas&&tool==="select"&&selected?.kind==="area"&&mesh.areas.filter(a=>a.id===selected.id).map(a=><g key={"edit-"+a.id} data-area-editor={a.id}>
       {a.points.map((v,i)=>{const next=a.points[(i+1)%a.points.length];return <line key={"edge-"+i} data-kind="area-edge" data-id={a.id} data-index={i}
        x1={v.x} y1={v.y} x2={next.x} y2={next.y} stroke="transparent" strokeWidth="28" pointerEvents="stroke"/>;})}
       {a.points.map((v,i)=><g key={"vertex-"+i}>
         <SpatialVertexHandle x={v.x} y={v.y} index={i} objectId={a.id}
          selected={selectedAreaVertex===i} label={"Đỉnh "+(i+1)+" của "+a.label}
          fill={selectedAreaVertex===i?"#fff0a5":"#eafcff"} stroke="#1f5b73"
          onSelect={()=>setSelectedAreaVertex(i)}
          onNudge={(dx,dy)=>update(d=>{const area=d.areas.find(item=>item.id===a.id),vertex=area?.points[i];if(vertex){vertex.x=clamp(vertex.x+dx,0,1920);vertex.y=clamp(vertex.y+dy,0,1080);}},"Đã di chuyển đỉnh "+(i+1)+" bằng bàn phím.")}
          onDelete={()=>{if(a.points.length<=3){setNote("Khu vực phải giữ tối thiểu 3 đỉnh.");return;}update(d=>{const area=d.areas.find(item=>item.id===a.id);area?.points.splice(i,1);},"Đã xóa đỉnh "+(i+1));setSelectedAreaVertex(null);}}/>
        <text x={v.x} y={v.y+6} textAnchor="middle" fill="#24475d" fontSize="17" fontWeight="900" pointerEvents="none">{i+1}</text>
       </g>)}
      </g>)}
      {tool==="area"&&areaDraft.length>0&&<g data-area-draft="true">
       {areaDraft.length>=3&&<polygon points={poly(areaDraft)} fill="#28bca8" fillOpacity=".17" stroke="#f5e5a7" strokeWidth="4" strokeDasharray="12 9" pointerEvents="none"/>}
       <polyline points={poly(areaDraft)} fill="none" stroke="#fff6b1" strokeWidth="7" strokeLinecap="round" pointerEvents="none"/>
       {areaDraft.map((v,i)=><g key={i}>
        <circle data-area-draft-close={i===0&&areaDraft.length>=3?"true":undefined} cx={v.x} cy={v.y} r={i===0?22:16} fill={i===0?"#ffe8a1":"#eafcff"} stroke="#2a6072" strokeWidth="5"/>
        <text x={v.x} y={v.y+6} fill="#24475d" textAnchor="middle" fontSize="16" fontWeight="800" pointerEvents="none">{i+1}</text>
       </g>)}
      </g>}

      {anchor&&<g pointerEvents="none">
       {cursorPoint&&<line x1={anchor.x} y1={anchor.y} x2={cursorPoint.x} y2={tool==="lane"?anchor.y:cursorPoint.y} stroke="#fff2a6" strokeDasharray="12 8" strokeWidth="6"/>}
       <circle cx={anchor.x} cy={anchor.y} r="18" fill="#fff7aa" stroke="#3c586c" strokeWidth="5"/>
       <text x={anchor.x+24} y={anchor.y-24} fill="#fff" fontSize="23" paintOrder="stroke" stroke="#203c4a" strokeWidth="6">Điểm đầu · chọn điểm cuối</text>
      </g>}
     </svg>
    </div>
    <div className="house-stage-foot"><span>{selected?"Đang chọn: "+selected.id:"Bấm đối tượng trên House để chỉnh thuộc tính"}</span><span>{Object.values(loaded).filter(Boolean).length}/3 lớp ảnh House được xác nhận tải</span><span>{preview?"● PAP-651 motion mô phỏng · không có Presence":"Canvas 16:9 · Không lưu thật"}</span></div>
    <p className="house-canvas-hint" role="status">{note}</p>
   </div>
   {inspectorOpen&&<aside className="house-side house-inspector"><h3>Thuộc tính đối tượng <button type="button" className="house-inspector-close" onClick={()=>setInspectorOpen(false)} aria-label="Đóng Inspector">×</button></h3>{!selected||!pickValue?<p className="house-inspector-empty">Chọn đối tượng trên House để chỉnh tọa độ và thuộc tính.</p>:<>
    <span className="house-selection-id">{selected.id}</span><span className="house-selection-kind">{selected.kind.toUpperCase()}</span>
    {selected.kind==="lane"&&"x1" in pickValue&&<>
      <label>Đầu X1<input type="number" min="0" max="1920" value={pickValue.x1} onChange={e=>changeNumber("x1",Number(e.target.value))}/></label>
      <label>Cuối X2<input type="number" min="0" max="1920" value={pickValue.x2} onChange={e=>changeNumber("x2",Number(e.target.value))}/></label>
      <label>Trục Y<input type="number" min="0" max="1080" value={pickValue.y} onChange={e=>changeNumber("y",Number(e.target.value))}/></label>
      <label>Chiều sâu<select value={pickValue.midLayer} onChange={e=>update(d=>{const l=d.lanes.find(x=>x.id===selected.id);if(l)l.midLayer=e.target.value==="behind"?"behind":"front";})}><option value="front">Trước HouseMid</option><option value="behind">Sau HouseBack, trước HouseMid</option></select></label>
    </>}
    {(selected.kind==="checkpoint"||selected.kind==="pin")&&"laneId" in pickValue&&<>
      <label>Lane<select value={pickValue.laneId} onChange={e=>update(d=>{
       const pin=(selected.kind==="pin"?d.pins:d.checkpoints).find(x=>x.id===selected.id),lane=d.lanes.find(l=>l.id===e.target.value);
       if(pin&&lane){pin.laneId=lane.id;pin.x=clamp(pin.x,lane.x1+36,lane.x2-36);pin.y=lane.y;}
      },"Đã chuyển "+selected.id+" sang Lane mới (chỉ trên bản nháp).")}>
       {mesh.lanes.map(lane=><option key={lane.id} value={lane.id}>{lane.id}</option>)}
      </select></label>
      <label>Vị trí X<input type="number" min="0" max="1920" value={pickValue.x} onChange={e=>changeNumber("x",Number(e.target.value))}/></label>
      <label>Vị trí Y<input value={pickValue.y} readOnly/></label>
      {selected.kind==="checkpoint"&&"label" in pickValue&&<label>Tên checkpoint<input value={String(pickValue.label)} onChange={e=>update(d=>{const cp=d.checkpoints.find(x=>x.id===selected.id);if(cp)cp.label=e.target.value;})}/></label>}
    </>}
    {selected.kind==="connector"&&"from" in pickValue&&<>
     <p className="house-object-meta">A ({pickValue.from.x}, {pickValue.from.y}) → B ({pickValue.to.x}, {pickValue.to.y}). Kéo thân để di chuyển cả đoạn, hoặc kéo nút A/B để chỉnh riêng đầu nối.</p>
     <label>Đầu A · X<input type="number" min="0" max="1920" value={pickValue.from.x} onChange={e=>changeNumber("fromX",Number(e.target.value))}/></label>
     <label>Đầu A · Y<input type="number" min="0" max="1080" value={pickValue.from.y} onChange={e=>changeNumber("fromY",Number(e.target.value))}/></label>
     <label>Đầu B · X<input type="number" min="0" max="1920" value={pickValue.to.x} onChange={e=>changeNumber("toX",Number(e.target.value))}/></label>
     <label>Đầu B · Y<input type="number" min="0" max="1080" value={pickValue.to.y} onChange={e=>changeNumber("toY",Number(e.target.value))}/></label>
     <p className="house-object-meta">{resolvedConnectors.some(c=>c.id===selected.id)?"✓ Nối hai Lane hợp lệ":"⚠ Connector chưa nối được hai Lane hợp lệ; kiểm tra khoảng cách 120px."}</p>
    </>}
    {selected.kind==="area"&&"points" in pickValue&&<>
     <p className="house-object-meta">{pickValue.label} · {pickValue.points.length} đỉnh · Kéo đa giác để dời cả vùng.</p>
     <label>Nhãn vùng<input value={pickValue.label} onChange={e=>update(d=>{const a=d.areas.find(x=>x.id===selected.id);if(a)a.label=e.target.value;})}/></label>
     <div className="house-area-vertex-list" aria-label="Danh sách đỉnh đa giác"><strong>Đỉnh đa giác</strong>
      <div>{pickValue.points.map((v,i)=><button type="button" key={i} aria-pressed={selectedAreaVertex===i} onClick={()=>setSelectedAreaVertex(i)}>
       Đỉnh {i+1} · {Math.round(v.x)}, {Math.round(v.y)}
      </button>)}</div>
     </div>
     {selectedAreaVertex!==null&&pickValue.points[selectedAreaVertex]&&<div className="house-area-vertex-edit">
      <label>Tọa độ X<input type="number" min="0" max="1920" value={pickValue.points[selectedAreaVertex].x} onChange={e=>changeNumber("vertexX",Number(e.target.value))}/></label>
      <label>Tọa độ Y<input type="number" min="0" max="1080" value={pickValue.points[selectedAreaVertex].y} onChange={e=>changeNumber("vertexY",Number(e.target.value))}/></label>
      <button type="button" className="house-delete" disabled={pickValue.points.length<=3} onClick={del}>Xóa đỉnh {selectedAreaVertex+1}</button>
     </div>}
     <p className="house-object-meta">Bấm trên cạnh để chèn đỉnh; kéo từng nút tròn để chỉnh hình. Chọn đỉnh để nhập tọa độ hoặc nhấn Delete; ít nhất 3 đỉnh.</p>
    </>}
    <button type="button" className="house-delete" onClick={del}>{selected.kind==="area"&&selectedAreaVertex===null?"Xóa toàn khu vực (local)":selected.kind==="area"?"Xóa đỉnh được chọn":"Xóa đối tượng (local)"}</button>
   </>}
    <div className="house-validation"><h4>Kiểm tra hình học</h4><p>{resolvedConnectors.length}/{mesh.connectors.length} Connector có thể chuyển giữa hai Lane theo bộ giải PAP-651.</p>
     {issueList.length?<ul>{issueList.map((q,i)=><li key={i}>{q}</li>)}</ul>:<p>✓ Tọa độ, Lane, Connector và marker đều hợp lệ trong bản nháp.</p>}
    </div>
    <div className="house-legend"><h4>Chú giải</h4><div><i className="front"/> Lane phía trước</div><div><i className="behind"/> Lane phía sau</div><div><i className="connector"/> Connector</div><div><i className="area"/> Vùng hoạt động</div><div><i className="checkpoint"/> Checkpoint</div><div><i className="pin"/> Emergence</div></div>
   </aside>}
  </div>
  <section id="house-function-guide" className="house-function-guide" aria-labelledby="house-function-guide-title">
   <div className="house-guide-heading">
    <h3 id="house-function-guide-title">Chú thích chức năng</h3>
    <p>Mỗi thành phần dùng để làm gì và cách thao tác trong bản thiết kế House Mesh.</p>
   </div>
   <dl className="house-guide-grid">
    {houseFunctionGuide.map(item=><div className="house-guide-item" key={item.name}>
     <dt><span className="house-guide-icon" aria-hidden="true">{item.icon}</span>{item.name}</dt>
     <dd><strong>Mục đích</strong><span>{item.purpose}</span></dd>
     <dd><strong>Cách dùng</strong><span>{item.how}</span></dd>
    </div>)}
   </dl>
   <p className="house-guide-note"><strong>Công cụ hỗ trợ:</strong> Snap 10px giúp căn tọa độ; Layers bật/tắt các lớp khi thiết kế; Thuộc tính chỉnh đối tượng đã chọn; Undo/Khôi phục bố cục hoàn tác; Chạy thử 20 Piner theo hàm chuyển động PAP-651 trên Mesh đang thiết kế (chỉ là tác nhân giả lập, không có Presence). Không ghi Core, không publish hay điều khiển TV thật.</p>
  </section>
 </section></SpatialEditorFrame>;
}
