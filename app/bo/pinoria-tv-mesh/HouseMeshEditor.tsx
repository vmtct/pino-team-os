"use client";
import {useEffect,useMemo,useRef,useState,type PointerEvent as Pointer} from "react";
import seed from "../../pinoria-tv/ambient-house-motion-graph.saved.json";
import prototypeAreas from "../../pinoria-tv/ambient-house-areas.prototype.json";
import prototypeEmergence from "../../pinoria-tv/ambient-house-emergence.prototype.json";
import {prototypeSpatialDraft,boundsOfPoints} from "@/lib/pinoria-tv-mesh-geometry";
import {draftFromSavedGraph,spatialTvConfigApi,configIssues,type Area,type Connector,type EmergencePin,type Lane,type Point,type SpatialConfig,type SpatialHead,type SpatialVersion,type TvConfigScope} from "@/lib/pinoria-tv-spatial-config-client";
import {createAmbientAgents,stepAmbientAgents,ambientMinimumVisibleSeparation,type AmbientAgent,type AmbientMotionGraph} from "../../pinoria-tv/ambient-house-motion";
import {applyMeshDrag} from "@/lib/pinoria-tv-mesh-drag";
import styles from "./mesh.module.css";
type Mode="select"|"pan"|"assign"|"lane"|"connector"|"area"|"pin";
type Pick={kind:"lane"|"area"|"pin"|"connector";id:string}|null;
const newId=(prefix:string)=>prefix+"-"+(crypto.randomUUID?.()??Math.random().toString(36).slice(2));
const seedConfig=()=>prototypeSpatialDraft(draftFromSavedGraph({horizontalLanes:seed.horizontalLanes as Lane[],rawConnectors:seed.rawConnectors as Connector[]}),prototypeAreas,prototypeEmergence);
const between=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const comma=(s:string)=>[...new Set(s.split(",").map(v=>v.trim()).filter(Boolean))];
export function HouseMeshEditor(){
 const svg=useRef<SVGSVGElement>(null),history=useRef<SpatialConfig[]>([]),anchor=useRef<Point|null>(null),drag=useRef<{pick:Pick;origin:SpatialConfig;from:Point;vertexIndex?:number}|null>(null),panDrag=useRef<{x:number;y:number;origin:Point}|null>(null);
 const[config,setConfig]=useState<SpatialConfig>(seedConfig),[mode,setMode]=useState<Mode>("select"),[pick,setPick]=useState<Pick>(null),[scopeKind,setScopeKind]=useState<"DEFAULT"|"CENTER">("DEFAULT"),[centerId,setCenterId]=useState("");
 const[head,setHead]=useState<SpatialHead|null>(null),[versions,setVersions]=useState<SpatialVersion[]>([]),[chosenVersion,setChosenVersion]=useState(""),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[info,setInfo]=useState(""),[error,setError]=useState("");
 const[zoom,setZoom]=useState(1),[panOrigin,setPanOrigin]=useState<Point>({x:0,y:0}),[snap,setSnap]=useState(true),[globalPin,setGlobalPin]=useState(true),[simulating,setSimulating]=useState(false),[previewActors,setPreviewActors]=useState<AmbientAgent[]>([]);
 const issues=useMemo(()=>configIssues(config),[config]),scope:TvConfigScope=scopeKind==="DEFAULT"?{kind:"DEFAULT"}:{kind:"CENTER",centerId};
 const previewGraph=useMemo<AmbientMotionGraph>(()=>({
   canvas:{width:1920,height:1080},miniCharacter:{width:164,height:115},
   horizontalLanes:config.graph.horizontalLanes,rawConnectors:config.graph.rawConnectors,
 }),[config]);
 useEffect(()=>{
   if(!simulating||issues.length){setPreviewActors([]);return;}
   const ids=Array.from({length:20},(_,i)=>`preview-actor-${i+1}`);
   let current:AmbientAgent[];
   try{current=createAmbientAgents(ids,previewGraph);}catch{setSimulating(false);setError("Mesh preview has no safe placement");return;}
   setPreviewActors(current);
   const timer=window.setInterval(()=>{
     try{current=stepAmbientAgents(current,previewGraph,64);setPreviewActors(current);}
     catch{window.clearInterval(timer);setSimulating(false);setError("Mesh preview stopped: motion constraint failed");}
   },64);
   return()=>window.clearInterval(timer);
 },[simulating,previewGraph,issues.length]);
 const selectedArea=pick?.kind==="area"?config.areas.find(a=>a.id===pick.id):config.areas[0];
 const selected=pick?.kind==="lane"?config.graph.horizontalLanes.find(a=>a.id===pick.id):pick?.kind==="area"?config.areas.find(a=>a.id===pick.id):pick?.kind==="pin"?config.emergencePins.find(a=>a.id===pick.id):pick?.kind==="connector"?config.graph.rawConnectors.find(a=>a.id===pick.id):null;
 function mutate(edit:(v:SpatialConfig)=>void){setConfig(prev=>{history.current.push(structuredClone(prev));const next=structuredClone(prev);edit(next);return next;});setDirty(true);setError("");}
 function coord(e:Pointer<SVGSVGElement>):Point{const m=svg.current?.getScreenCTM();if(!m)return{x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());const step=snap?10:1;return{x:between(Math.round(p.x/step)*step,0,1920),y:between(Math.round(p.y/step)*step,0,1080)};}
 async function load(){
   setBusy(true);setError("");
   try{const[h,vs]=await Promise.all([spatialTvConfigApi.head(scope),spatialTvConfigApi.versions(scope)]);
     const applied=h?.active_version_id?(await spatialTvConfigApi.version(scope,h.active_version_id))?.configuration:null;
     const inherited=!applied&&scope.kind==="CENTER"?(await spatialTvConfigApi.active(scope.centerId))?.configuration:null;
     setConfig(applied??inherited??seedConfig());setHead(h);setVersions(vs);setChosenVersion(h?.active_version_id??"");history.current=[];setDirty(false);
     setInfo(applied?"Đã tải cấu hình hiện hành.":"House mesh 1920×1080 đã nạp; chưa có publish.");}
   catch(e){setError(e instanceof Error?e.message:"Không tải được Core config");}finally{setBusy(false);}
 }
 useEffect(()=>{void load();/* initial DEFAULT scope */},[]);
 async function save(action:"drafts"|"publish"|"revert"){
   if(busy)return;if(scopeKind==="CENTER"&&!/^[0-9a-f-]{36}$/i.test(centerId)){setError("Center ID không hợp lệ");return;}
   if(action!=="drafts"&&(!chosenVersion||issues.length)){setError("Chọn version hợp lệ và sửa lỗi trước khi publish");return;}
   setBusy(true);setError("");
   try{const result=await spatialTvConfigApi.write(action,{scope,expectedRevision:head?.revision??0,...(action==="drafts"?{configuration:config}:{versionId:chosenVersion})});
     const[h,v]=await Promise.all([spatialTvConfigApi.head(scope),spatialTvConfigApi.versions(scope)]);setHead(h);setVersions(v);
     setChosenVersion(String(action==="drafts"?result.id:result.appliedVersion));setDirty(false);setInfo(action==="drafts"?"Đã lưu nháp; TV chưa thay đổi.":action==="publish"?"Published.":"Reverted.");}
   catch(e){setError((e instanceof Error?e.message:"Write failed")+" — Reload Core before retrying.");}finally{setBusy(false);}
 }
 async function inspect(id:string){if(dirty&&!confirm("Hủy thay đổi chưa lưu?"))return;setBusy(true);
   try{const version=await spatialTvConfigApi.version(scope,id);if(!version)throw Error("Version not found");setConfig(version.configuration);setChosenVersion(id);setDirty(false);setPick(null);history.current=[];setInfo("Snapshot revision "+version.revision);}catch(e){setError(e instanceof Error?e.message:"Load failed");}finally{setBusy(false);}
 }
 function down(e:Pointer<SVGSVGElement>){
   if(busy||e.button!==0)return;const p=coord(e),el=e.target as Element,kind=el.getAttribute("data-kind") as NonNullable<Pick>["kind"]|null,id=el.getAttribute("data-id");
   if(mode==="pan"){panDrag.current={x:e.clientX,y:e.clientY,origin:{...panOrigin}};svg.current?.setPointerCapture(e.pointerId);return;}
   if(mode==="assign"){if(!selectedArea||kind!=="lane"||!id){setInfo("Select an Area first, then click its lanes.");return;}mutate(v=>{const area=v.areas.find(a=>a.id===selectedArea.id);if(area){area.laneIds=area.laneIds.includes(id)?area.laneIds.filter(value=>value!==id):[...area.laneIds,id];}});return;}
   if(mode==="select"&&kind&&id){const found:Pick={kind,id};setPick(found);if(kind==="lane"||kind==="pin"||kind==="area"){drag.current={pick:found,origin:structuredClone(config),from:p,...(kind==="area"&&el.getAttribute("data-vertex-index")!==null?{vertexIndex:Number(el.getAttribute("data-vertex-index"))}:{})};svg.current?.setPointerCapture(e.pointerId);}return;}
   if(mode==="lane"){const lane:Lane={id:newId("lane"),x1:between(p.x-220,0,1920),x2:between(p.x+220,0,1920),y:p.y,midLayer:"front"};mutate(v=>v.graph.horizontalLanes.push(lane));setPick({kind:"lane",id:lane.id});}
   if(mode==="connector"){if(!anchor.current){anchor.current=p;setInfo("Chọn điểm cuối connector");return;}const link:Connector={id:newId("connector"),from:anchor.current,to:p};anchor.current=null;mutate(v=>v.graph.rawConnectors.push(link));setPick({kind:"connector",id:link.id});}
   if(mode==="area"){if(!anchor.current){anchor.current=p;setInfo("Chọn điểm đối diện của Area");return;}const a=anchor.current;anchor.current=null;const x=Math.min(a.x,p.x),y=Math.min(a.y,p.y),width=Math.max(40,Math.abs(a.x-p.x)),height=Math.max(40,Math.abs(a.y-p.y));const bx={x,y,width:between(width,40,1920-x),height:between(height,40,1080-y)};const area:Area={id:newId("area"),bounds:bx,points:[{x:bx.x,y:bx.y},{x:bx.x+bx.width,y:bx.y},{x:bx.x+bx.width,y:bx.y+bx.height},{x:bx.x,y:bx.y+bx.height}],laneIds:config.graph.horizontalLanes.filter(l=>l.y>=y&&l.y<=y+height&&l.x2>=x&&l.x1<=x+width).map(l=>l.id),pathCodes:[],learningSpaceCodes:[]};mutate(v=>v.areas.push(area));setPick({kind:"area",id:area.id});}
   if(mode==="pin"){
      if(!globalPin&&!selectedArea){setError("Chọn Area trước");return;}
      const lanes=globalPin?config.graph.horizontalLanes:config.graph.horizontalLanes.filter(l=>selectedArea?.laneIds.includes(l.id));
      const lane=lanes.sort((a,b)=>Math.abs(a.y-p.y)-Math.abs(b.y-p.y))[0];
      if(!lane){setError("Không có lane cho pin");return;}
      const pin:EmergencePin={id:newId("pin"),...(globalPin?{}:{areaId:selectedArea!.id}),laneId:lane.id,
        x:between(p.x,lane.x1+36,lane.x2-36),y:lane.y};
      mutate(v=>v.emergencePins.push(pin));setPick({kind:"pin",id:pin.id});
    }
 }
 function move(e:Pointer<SVGSVGElement>){
   if(panDrag.current){
     const r=svg.current?.getBoundingClientRect();
     if(r){const x=1920/zoom,y=1080/zoom;const dx=(e.clientX-panDrag.current.x)*x/r.width,dy=(e.clientY-panDrag.current.y)*y/r.height;setPanOrigin({x:between(panDrag.current.origin.x-dx,0,1920-x),y:between(panDrag.current.origin.y-dy,0,1080-y)});}
     return;
   }
   const d=drag.current;
   if(!d?.pick||d.pick.kind==="connector")return;
   const next=applyMeshDrag(d.origin,d.pick, d.from, coord(e), d.vertexIndex);
   setConfig(next);
   setDirty(true);
   setError("");
 }
 function up(e:Pointer<SVGSVGElement>){panDrag.current=null;if(drag.current){history.current.push(drag.current.origin);drag.current=null;}if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);}
 function edit(field:string,value:unknown){if(!pick)return;mutate(v=>{const item=pick.kind==="lane"?v.graph.horizontalLanes.find(l=>l.id===pick.id):pick.kind==="area"?v.areas.find(a=>a.id===pick.id):pick.kind==="pin"?v.emergencePins.find(a=>a.id===pick.id):v.graph.rawConnectors.find(a=>a.id===pick.id);if(item)(item as unknown as Record<string,unknown>)[field]=value;});}
 function updateAreaBounds(areaId:string,key:"x"|"y"|"width"|"height",value:number){
   mutate(v=>{const area=v.areas.find(a=>a.id===areaId);if(!area)return;
     const before={...area.bounds};const after={...before,[key]:value};
     if(area.points&&before.width>0&&before.height>0){
       area.points=area.points.map(p=>({
         x:after.x+(p.x-before.x)*after.width/before.width,
         y:after.y+(p.y-before.y)*after.height/before.height,
       }));
     }
     area.bounds=after;
   });
 }
 function drop(){if(!pick)return;mutate(v=>{if(pick.kind==="lane"){v.graph.horizontalLanes=v.graph.horizontalLanes.filter(x=>x.id!==pick.id);for(const a of v.areas)a.laneIds=a.laneIds.filter(l=>l!==pick.id);v.emergencePins=v.emergencePins.filter(x=>x.laneId!==pick.id);}if(pick.kind==="connector")v.graph.rawConnectors=v.graph.rawConnectors.filter(x=>x.id!==pick.id);if(pick.kind==="area"){v.areas=v.areas.filter(x=>x.id!==pick.id);v.emergencePins=v.emergencePins.filter(x=>x.areaId!==pick.id);}if(pick.kind==="pin")v.emergencePins=v.emergencePins.filter(x=>x.id!==pick.id);});setPick(null);}
 return <main className={styles.page}><header><div><small>PINORIA TV · PAP-656</small><h1>House Mesh Configurator</h1><p>16:9 · 1920×1080 canvas · versioned Core authority</p></div><div className={styles.row}><button onClick={()=>{const h=history.current.pop();if(h){setConfig(h);setDirty(true);}}}>Undo</button><button onClick={()=>void load()}>Reload</button><button onClick={()=>void save("drafts")} disabled={busy||!dirty}>Save draft</button></div></header>
 <nav className={styles.row}><label>Scope <select value={scopeKind} onChange={e=>setScopeKind(e.target.value as "DEFAULT"|"CENTER")}><option>DEFAULT</option><option>CENTER</option></select></label>{scopeKind==="CENTER"&&<label>Center ID <input value={centerId} onChange={e=>setCenterId(e.target.value)} placeholder="Center UUID"/></label>}<button onClick={()=>void load()} disabled={busy}>Open</button><label>Zoom <input aria-label="Canvas zoom" type="range" min="1" max="2.5" step=".25" value={zoom} onChange={e=>{const next=Number(e.target.value);setZoom(next);setPanOrigin(p=>({x:between(p.x,0,1920-1920/next),y:between(p.y,0,1080-1080/next)}));}}/>{Math.round(zoom*100)}%</label><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/> Snap 10px</label><span>Revision {head?.revision??0} · {dirty?"Unsaved":"Synced"}</span></nav>
 {error&&<p role="alert" className={styles.error}>{error}</p>}{info&&<p role="status">{info}</p>}
 <section className={styles.workbench}><aside className={styles.panel}><h3>Tools</h3>{(["select","pan","assign","lane","connector","area","pin"] as Mode[]).map(v=><button key={v} className={mode===v?styles.active:""} onClick={()=>{setMode(v);anchor.current=null;}}>{({select:"↖ Select / drag",pan:"✋ Pan",assign:"◇ Assign lanes",lane:"━ Lane",connector:"╱ Connector",area:"▧ Area bounds",pin:"● Emergence pin"})[v]}</button>)}<hr/><small>{config.graph.horizontalLanes.length} lanes · {config.graph.rawConnectors.length} connectors</small><small>{config.areas.length} areas · {config.emergencePins.length} pins</small><button disabled={issues.length>0} onClick={()=>setSimulating(value=>!value)}>{simulating?"Stop motion preview":"Preview 20 actors"}</button><label><input type="checkbox" checked={globalPin} onChange={e=>setGlobalPin(e.target.checked)}/>Global emergence</label></aside>
 <div className={styles.stage}><svg ref={svg} viewBox={`${panOrigin.x} ${panOrigin.y} ${1920/zoom} ${1080/zoom}`} preserveAspectRatio="xMidYMid meet" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Pinoria House mesh editor" role="img"><defs><pattern id="pap656-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#fff" strokeOpacity=".14"/></pattern></defs><rect width="1920" height="1080" fill="#17263d"/><image href="https://assets.pinohouse.art/draft/HouseBack.png" width="1920" height="1080" preserveAspectRatio="xMidYMid slice" opacity=".7"/><rect width="1920" height="1080" fill="url(#pap656-grid)" pointerEvents="none"/>
 {config.areas.map(a=><g key={a.id}>
   {a.points?.length
     ? <polygon data-kind="area" data-id={a.id} points={a.points.map(p=>`${p.x},${p.y}`).join(" ")}
         fill="#4dd7c3" fillOpacity=".16" stroke={pick?.id===a.id?"#f8c7f6":"#4dd7c3"} strokeWidth="5" strokeDasharray="13 10"/>
     : <rect data-kind="area" data-id={a.id} {...a.bounds}
         fill="#4dd7c3" fillOpacity=".16" stroke={pick?.id===a.id?"#f8c7f6":"#4dd7c3"} strokeWidth="5" strokeDasharray="13 10"/>}
   <text x={a.bounds.x+20} y={a.bounds.y+35} fontSize="24" fill="#fff" pointerEvents="none">{a.id}</text>
   {pick?.kind==="area"&&pick.id===a.id&&a.points?.map((p,i)=>
     <circle key={i} data-kind="area" data-id={a.id} data-vertex-index={i}
       cx={p.x} cy={p.y} r="13" fill="#ffe59b" stroke="#263a45" strokeWidth="4"/>)}
 </g>)}
 {config.graph.rawConnectors.map(c=><line key={c.id} data-kind="connector" data-id={c.id} x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke="#f8b867" strokeWidth="8" strokeDasharray="18 7"/>)}
 {config.graph.horizontalLanes.map(l=><g key={l.id}><line data-kind="lane" data-id={l.id} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} stroke={pick?.id===l.id?"#fff7a0":l.midLayer==="behind"?"#8da1ff":"#93f2be"} strokeWidth={pick?.id===l.id?13:8} strokeLinecap="round"/><text x={l.x1+10} y={l.y-16} fontSize="20" fill="white" pointerEvents="none">{l.id}</text></g>)}
 {config.emergencePins.map(p=><circle key={p.id} data-kind="pin" data-id={p.id} cx={p.x} cy={p.y} r={pick?.id===p.id?27:20} fill="#f87cbf" stroke="white" strokeWidth="5"/>)}{previewActors.map(actor=><g key={actor.id} pointerEvents="none"><circle cx={actor.x} cy={actor.y} r="21" stroke="white" strokeWidth="4" fill={actor.depth==="front"?"#9ae6ca":"#9ba9ff"}/><text x={actor.x} y={actor.y+6} textAnchor="middle" fontSize="15" fill="#193048">{actor.id.slice(-2)}</text></g>)}</svg><small>House canvas: 1920×1080 · production motion engine simulation · {previewActors.length? `minimum clearance ${Math.round(ambientMinimumVisibleSeparation(previewActors))}px`:"uniformly scaled"}</small></div>
 <aside className={styles.panel}><h3>Inspector</h3>{!selected?<p>Select an item to edit.</p>:<><strong>{selected.id}</strong>{"midLayer" in selected&&<label>Depth <select value={selected.midLayer} onChange={e=>edit("midLayer",e.target.value)}><option>front</option><option>behind</option></select></label>}
 {"x1" in selected&&(["x1","x2","y"] as const).map(k=><label key={k}>{k} <input type="number" value={selected[k]} onChange={e=>edit(k,Number(e.target.value))}/></label>)}
 {"bounds" in selected&&<>{(["x","y","width","height"] as const).map(k=><label key={k}>Bounds {k}<input type="number" value={selected.bounds[k]} onChange={e=>updateAreaBounds(selected.id,k,Number(e.target.value))}/></label>)}<label>Lane IDs <input value={selected.laneIds.join(",")} onChange={e=>edit("laneIds",comma(e.target.value))}/></label><label>Path codes <input value={(selected.pathCodes??[]).join(",")} onChange={e=>edit("pathCodes",comma(e.target.value))}/></label><label>LearningSpace codes <input value={(selected.learningSpaceCodes??[]).join(",")} onChange={e=>edit("learningSpaceCodes",comma(e.target.value))}/></label></>}
 {"areaId" in selected&&<><label>Area ID <input value={selected.areaId??""} onChange={e=>edit("areaId",e.target.value||undefined)}/></label><label>X <input type="number" value={selected.x} onChange={e=>edit("x",Number(e.target.value))}/></label></>}
 {"from" in selected&&<>{(["from","to"] as const).map(which=><fieldset key={which}>
   <legend>{which==="from"?"Connector start":"Connector end"}</legend>
   {(["x","y"] as const).map(axis=><label key={axis}>{axis.toUpperCase()}
     <input type="number" value={selected[which][axis]} onChange={e=>mutate(v=>{
       const link=v.graph.rawConnectors.find(c=>c.id===selected.id);
       if(link)link[which][axis]=Number(e.target.value);
     })}/></label>)}
 </fieldset>)}</>}
 <button onClick={drop}>Delete selection</button></>}<hr/><h3>Validation</h3>{issues.length?<ul>{issues.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p className={styles.success}>Basic geometry OK; Core validates on publish.</p>}</aside></section>
 <footer className={styles.row}><label>Version <select value={chosenVersion} onChange={e=>void inspect(e.target.value)}><option value="">Select revision</option>{versions.map(v=><option key={v.id} value={v.id}>#{v.revision} {v.applied?"(live)":""} · {v.id.slice(0,8)}</option>)}</select></label><button disabled={busy||!chosenVersion||issues.length>0} onClick={()=>void save("publish")}>Publish</button><button disabled={busy||!chosenVersion} onClick={()=>void save("revert")}>Revert</button><small>Draft is private. No student/PLS/reward mutation.</small></footer></main>;
}
