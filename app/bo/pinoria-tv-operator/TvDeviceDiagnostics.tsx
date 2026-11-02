"use client";
import { useEffect, useRef, useState } from "react";
import { describeTvHealthObservation, type TvHealthFact } from "@/lib/pap1333-tv-health-observation";
type BoTvHealth = { centerId:string; deviceSessions:Array<{sessionId:string;deviceId:string;displayId:string;lastSeenAt:string;expiresAt:string;definitionVersion:number;runtimeType:string;heartbeatFresh:boolean;rendererAcknowledged:false}&TvHealthFact> };
async function readBoTvHealth(centerId:string):Promise<BoTvHealth>{
  const response=await fetch(`/api/bo/tv/operator-health?centerId=${encodeURIComponent(centerId)}`,{cache:"no-store"});
  const payload=await response.json() as {data?:BoTvHealth;error?:{message?:string}};
  if(!response.ok||!payload.data||payload.data.centerId!==centerId)throw new Error(payload.error?.message??"Không thể đọc TV health từ BO");
  return payload.data;
}
import { describeDeviceSession } from "@/lib/pap659-tv-session-status";

type Device = {id:string;displayName:string;centerId:string|null;status:string;lastSeenAt:string|null;defaultDisplayId:string|null;viewportWidth:number|null;viewportHeight:number|null};
type Display = {id:string;displayName:string;runtimeType:string;scopeType:string;scopeId:string|null;targetAspectRatio:string;definitionVersion:number;status:string};
/** Read-only BO diagnostics. Server authorizes device reads; never infer physical ACK. */
export function TvDeviceDiagnostics({centerContextId}:{centerContextId?:string}={}){
  const [devices,setDevices]=useState<Device[]|null>(null);
  const [displays,setDisplays]=useState<Display[]|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const refreshInFlight=useRef(false);
  const [centerId,setCenterId]=useState(centerContextId??"");
  const [health,setHealth]=useState<BoTvHealth|null>(null);
  const requestGeneration=useRef(0);
  useEffect(()=>()=>{requestGeneration.current+=1;},[]);
  async function refresh(){
    if(refreshInFlight.current)return;
    refreshInFlight.current=true;
    const generation=++requestGeneration.current;
    setBusy(true);setError("");setHealth(null);
    try{
      const [response,displayResponse]=await Promise.all([fetch("/api/bo/tv/devices",{cache:"no-store"}),fetch("/api/bo/tv/displays",{cache:"no-store"})]);
      const payload=await response.json() as {data?:Device[];error?:{message?:string}};
      if(!response.ok || !Array.isArray(payload.data))throw new Error(payload.error?.message??"Không thể đọc device status");
      const displayPayload=await displayResponse.json() as {data?:Display[];error?:{message?:string}};
      if(!displayResponse.ok || !Array.isArray(displayPayload.data))throw new Error(displayPayload.error?.message??"Không thể đọc TV definitions");
      const allowedCenters=[...new Set(payload.data.map(device=>device.centerId).filter((id):id is string=>Boolean(id)))];
      const selectedCenter=centerContextId ? (allowedCenters.includes(centerContextId)?centerContextId:null) : allowedCenters.includes(centerId.trim())?centerId.trim():allowedCenters.length===1?allowedCenters[0]:null;
      let operatorHealth:BoTvHealth|null=null;
      if(selectedCenter){try{operatorHealth=await readBoTvHealth(selectedCenter);}catch(cause){if(generation===requestGeneration.current)setError(cause instanceof Error?cause.message:"Core health không khả dụng");}}
      if(generation===requestGeneration.current){setDevices(payload.data);setDisplays(displayPayload.data);setCenterId(selectedCenter??"");setHealth(operatorHealth);}
    }catch(e){if(generation===requestGeneration.current)setError(e instanceof Error?e.message:"Không thể đọc device status");}
    finally{refreshInFlight.current=false;setBusy(false);}
  }
  return <section aria-label="TV device diagnostics" style={{border:"1px solid #ddd",borderRadius:12,padding:16,marginTop:16}}>
    <h2>Thiết bị & trạng thái kết nối</h2>
    <p>Chỉ báo cáo trạng thái thiết bị từ BO. Last seen không phải xác nhận TV đã render/ACK. Mở hoặc focus cửa sổ TV từ trình duyệt BO không được hỗ trợ.</p>
    <label>Center được phép xem {centerContextId?<strong>{centerContextId}</strong>:<select aria-label="Center for operator health" value={centerId} onChange={e=>{requestGeneration.current+=1;setCenterId(e.target.value);setHealth(null);}}><option value="">Tự chọn khi chỉ có một center</option>{[...new Set((devices??[]).map(device=>device.centerId).filter((id):id is string=>Boolean(id)))].map(id=><option key={id} value={id}>{id}</option>)}</select>}</label>
    <button type="button" disabled={busy} onClick={()=>void refresh()}>{busy?"Đang tải…":"Làm mới thiết bị"}</button>
    {error?<p role="alert">{error}</p>:null}
    {devices && !centerId && [...new Set(devices.map(device=>device.centerId).filter(Boolean))].length>1?<p role="status">Chọn center trong danh sách rồi làm mới để đọc TV health.</p>:null}
    {health?<p role="status">BO Core TV health · {health.deviceSessions.length} phiên được phép xem · Heartbeat không phải renderer ACK</p>:null}
    {health?.deviceSessions?.filter(session=>!centerId||devices?.some(device=>device.id===session.deviceId && device.centerId===centerId)).map(session=><div key={session.sessionId}>TV session: {session.sessionId} · Device: {session.deviceId} · Display: {session.displayId} · {session.heartbeatFresh?"Heartbeat gần đây (không phải ACK)":"Heartbeat cũ/offline chưa xác thực"} · Definition v{session.definitionVersion} · Không xác nhận hình ảnh TV</p><p role="status" data-testid="bo-tv-observation">Runtime observation: {describeTvHealthObservation(session)}</p></div>)}
    {devices?.length===0?<p>Không có thiết bị được cấp quyền xem.</p>:null}
    {devices && centerId && !devices.some(device=>device.centerId===centerId)?<p role="status">Center đã chọn không còn thiết bị được cấp quyền xem.</p>:null}
    <p><small>Phiên TV và độ mới heartbeat chỉ lấy từ Core (snapshot tối đa 20 phiên), không phải xác nhận kết nối vật lý hay renderer ACK. Build/config/assets chỉ hiển thị khi observation mới được Core xác thực; stale hoặc absent không được coi là hiện tại. Không dùng token TV.</small></p>
    {displays?.map(display=><article key={display.id} style={{padding:"8px 0"}}><strong>{display.displayName}</strong> · {display.status}<p>Runtime: {display.runtimeType} · Scope: {display.scopeType} · Aspect: {display.targetAspectRatio} · Definition v{display.definitionVersion}</p></article>)}
    {devices?.filter(device=>!centerId||device.centerId===centerId).map(device=>{const evidence=describeDeviceSession(health,centerId,device);return <article key={device.id} style={{padding:"10px 0",borderBottom:"1px solid #eee"}}>
      <strong>{device.displayName}</strong> · {device.status}
      <p>Center: {device.centerId??"Chưa gán"} · Display: {device.defaultDisplayId??"Chưa gán"}</p>
      <p>TV definition: {displays?.find(display=>display.id===device.defaultDisplayId)?.displayName??"Không tìm thấy trong danh sách được phép xem"} · Device ID: {device.id}</p>
      <small>Last seen (BO): {device.lastSeenAt??"Chưa ghi nhận"} · Core session: {evidence.kind==="unverified"?"Chưa có health cùng Center":evidence.kind==="not-observed"?"Không thấy trong snapshot tối đa 20 phiên (không xác nhận offline)":evidence.kind==="ambiguous"?"Nhiều phiên đồng thời (không có một TV đích duy nhất)":evidence.kind==="stale-heartbeat"?"Heartbeat cũ (không xác nhận online)":"Heartbeat gần đây (không phải renderer ACK)"} · Viewport: {device.viewportWidth&&device.viewportHeight?`${device.viewportWidth}×${device.viewportHeight}`:"Chưa ghi nhận"}</small>
      <p><small>{evidence.sessionId? `Core session: ${evidence.sessionId} · Display: ${evidence.displayId} · Last heartbeat: ${evidence.lastSeenAt}`:"Core không cung cấp một session đích duy nhất cho thiết bị này."} Renderer ACK: chưa xác thực. Build/config/assets chỉ hiển thị từ observation fresh.</small></p>
    </article>;})}
  </section>;
}
