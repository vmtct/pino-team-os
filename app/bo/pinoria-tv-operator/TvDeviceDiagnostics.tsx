"use client";
import { useState } from "react";

type Device = {id:string;displayName:string;centerId:string|null;status:string;lastSeenAt:string|null;defaultDisplayId:string|null;viewportWidth:number|null;viewportHeight:number|null};
/** Read-only BO diagnostics. Server authorizes device reads; never infer physical ACK. */
export function TvDeviceDiagnostics(){
  const [devices,setDevices]=useState<Device[]|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function refresh(){
    if(busy)return;
    setBusy(true);setError("");setDevices(null);
    try{
      const response=await fetch("/api/bo/tv/devices",{cache:"no-store"});
      const payload=await response.json() as {data?:Device[];error?:{message?:string}};
      if(!response.ok || !Array.isArray(payload.data))throw new Error(payload.error?.message??"Không thể đọc device status");
      setDevices(payload.data);
    }catch(e){setError(e instanceof Error?e.message:"Không thể đọc device status");}
    finally{setBusy(false);}
  }
  return <section aria-label="TV device diagnostics" style={{border:"1px solid #ddd",borderRadius:12,padding:16,marginTop:16}}>
    <h2>Thiết bị & trạng thái kết nối</h2>
    <p>Chỉ báo cáo trạng thái thiết bị từ BO. Last seen không phải xác nhận TV đã render/ACK. Mở hoặc focus cửa sổ TV từ trình duyệt BO không được hỗ trợ.</p>
    <button type="button" disabled={busy} onClick={()=>void refresh()}>{busy?"Đang tải…":"Làm mới thiết bị"}</button>
    {error?<p role="alert">{error}</p>:null}
    {devices?.length===0?<p>Không có thiết bị được cấp quyền xem.</p>:null}
    {devices?.map(device=><article key={device.id} style={{padding:"10px 0",borderBottom:"1px solid #eee"}}>
      <strong>{device.displayName}</strong> · {device.status}<p>Center: {device.centerId??"Chưa gán"} · Display: {device.defaultDisplayId??"Chưa gán"}</p>
      <small>Last seen: {device.lastSeenAt??"Chưa ghi nhận"} · Viewport: {device.viewportWidth&&device.viewportHeight?`${device.viewportWidth}×${device.viewportHeight}`:"Chưa ghi nhận"}</small>
    </article>)}
  </section>;
}
