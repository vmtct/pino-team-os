"use client";
import { useEffect, useRef, useState } from "react";
import { operatorPresentationClient, type OperatorHealth } from "@/app/pinoria-tv/operator-presentation-client";

type Device = {id:string;displayName:string;centerId:string|null;status:string;lastSeenAt:string|null;defaultDisplayId:string|null;viewportWidth:number|null;viewportHeight:number|null};
type Display = {id:string;displayName:string;runtimeType:string;scopeType:string;scopeId:string|null;targetAspectRatio:string;definitionVersion:number;status:string};
/** Read-only BO diagnostics. Server authorizes device reads; never infer physical ACK. */
export function TvDeviceDiagnostics(){
  const [devices,setDevices]=useState<Device[]|null>(null);
  const [displays,setDisplays]=useState<Display[]|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [centerId,setCenterId]=useState("");
  const [health,setHealth]=useState<OperatorHealth|null>(null);
  const requestGeneration=useRef(0);
  useEffect(()=>()=>{requestGeneration.current+=1;},[]);
  async function refresh(){
    if(busy)return;
    const generation=++requestGeneration.current;
    setBusy(true);setError("");setDevices(null);setDisplays(null);setHealth(null);
    try{
      const [response,displayResponse]=await Promise.all([fetch("/api/bo/tv/devices",{cache:"no-store"}),fetch("/api/bo/tv/displays",{cache:"no-store"})]);
      const payload=await response.json() as {data?:Device[];error?:{message?:string}};
      if(!response.ok || !Array.isArray(payload.data))throw new Error(payload.error?.message??"Không thể đọc device status");
      const displayPayload=await displayResponse.json() as {data?:Display[];error?:{message?:string}};
      if(!displayResponse.ok || !Array.isArray(displayPayload.data))throw new Error(displayPayload.error?.message??"Không thể đọc TV definitions");
      const allowedCenters=[...new Set(payload.data.map(device=>device.centerId).filter((id):id is string=>Boolean(id)))];
      const selectedCenter=allowedCenters.includes(centerId.trim())?centerId.trim():allowedCenters.length===1?allowedCenters[0]:null;
      const operatorHealth=selectedCenter?await operatorPresentationClient.operatorHealth(selectedCenter):null;
      if(generation===requestGeneration.current){setDevices(payload.data);setDisplays(displayPayload.data);setHealth(operatorHealth);}
    }catch(e){if(generation===requestGeneration.current)setError(e instanceof Error?e.message:"Không thể đọc device status");}
    finally{if(generation===requestGeneration.current)setBusy(false);}
  }
  return <section aria-label="TV device diagnostics" style={{border:"1px solid #ddd",borderRadius:12,padding:16,marginTop:16}}>
    <h2>Thiết bị & trạng thái kết nối</h2>
    <p>Chỉ báo cáo trạng thái thiết bị từ BO. Last seen không phải xác nhận TV đã render/ACK. Mở hoặc focus cửa sổ TV từ trình duyệt BO không được hỗ trợ.</p>
    <label>Center được phép xem <select aria-label="Center for operator health" value={centerId} onChange={e=>{requestGeneration.current+=1;setCenterId(e.target.value);setHealth(null);setBusy(false);}}><option value="">Tự chọn khi chỉ có một center</option>{[...new Set((devices??[]).map(device=>device.centerId).filter((id):id is string=>Boolean(id)))].map(id=><option key={id} value={id}>{id}</option>)}</select></label>
    <button type="button" disabled={busy} onClick={()=>void refresh()}>{busy?"Đang tải…":"Làm mới thiết bị"}</button>
    {error?<p role="alert">{error}</p>:null}
    {health?<p role="status">Core queue revision {health.queueRevision} · Pending {health.queuedCount} · Active {health.activePresentation?.kind??"None"} · Renderer ACK chưa xác thực</p>:null}
    {devices?.length===0?<p>Không có thiết bị được cấp quyền xem.</p>:null}
    <p><small>Chẩn đoán phiên TV thời gian thực, build manifest, phiên bản cấu hình đã áp dụng và tình trạng tài nguyên: chưa có read projection do Core xác thực. Không hiển thị dữ liệu giả hoặc sử dụng token của TV.</small></p>
    {displays?.map(display=><article key={display.id} style={{padding:"8px 0"}}><strong>{display.displayName}</strong> · {display.status}<p>Runtime: {display.runtimeType} · Scope: {display.scopeType} · Aspect: {display.targetAspectRatio} · Definition v{display.definitionVersion}</p></article>)}
    {devices?.map(device=><article key={device.id} style={{padding:"10px 0",borderBottom:"1px solid #eee"}}>
      <strong>{device.displayName}</strong> · {device.status}
      <p>Center: {device.centerId??"Chưa gán"} · Display: {device.defaultDisplayId??"Chưa gán"}</p>
      <p>TV definition: {displays?.find(display=>display.id===device.defaultDisplayId)?.displayName??"Không tìm thấy trong danh sách được phép xem"}</p>
      <small>Last seen: {device.lastSeenAt??"Chưa ghi nhận"} · Viewport: {device.viewportWidth&&device.viewportHeight?`${device.viewportWidth}×${device.viewportHeight}`:"Chưa ghi nhận"}</small>
      <p><small>Phiên hoạt động, phiên bản cấu hình áp dụng và asset health: chưa có bằng chứng xác thực từ Core; không suy diễn từ Last seen.</small></p>
    </article>)}
  </section>;
}
