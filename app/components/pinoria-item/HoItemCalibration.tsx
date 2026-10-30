"use client";
import {useEffect,useRef,useState,type PointerEvent} from "react";
import {assetUrl,getItem,uploadItem,writeItem,slotNames,type HoItem,type ItemInput} from "@/app/ho/pinoria/wardrobe/item-client";
import "./item-calibration.css";
type Position={positionX:number;positionY:number;scale:number;rotationDegrees:number|null};
const BASE_URL="https://assets.pinohouse.art/pinoria/char-base.png";
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
function initial(item:HoItem):Position{const source=item.pendingDraft??item;return {positionX:source.positionX,positionY:source.positionY,scale:source.scale,rotationDegrees:source.rotationDegrees}}
export function HoItemCalibration({itemId,canManage,onChange}:{itemId:string;canManage:boolean;onChange?:()=>void}){
 const [item,setItem]=useState<HoItem|null>(null);
 const [value,setValue]=useState<Position>({positionX:0,positionY:0,scale:1,rotationDegrees:null});
 const [imageFile,setImageFile]=useState<File|null>(null);
 const [localAsset,setLocalAsset]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [baseVisible,setBaseVisible]=useState(true),[opacity,setOpacity]=useState(.35);
 const [advanced,setAdvanced]=useState(false),[failedImage,setFailedImage]=useState(false);
 const stage=useRef<HTMLDivElement>(null);
 const drag=useRef<{x:number;y:number;positionX:number;positionY:number}|null>(null);
 const draft=(item?.status==="DRAFT"||item?.status==="PUBLISHED")&&canManage;
 const read=async()=>{const fresh=await getItem(itemId);setItem(fresh);setValue(initial(fresh));setError("");setImageFile(null);setLocalAsset(null);setFailedImage(false)};
 useEffect(()=>{let alive=true;const ctrl=new AbortController();getItem(itemId,ctrl.signal).then(fresh=>{if(alive){setItem(fresh);setValue(initial(fresh));setError("");setImageFile(null);setFailedImage(false)}}).catch(()=>{if(alive)setError("Không thể tải dữ liệu Item được cấp quyền.")});return()=>{alive=false;ctrl.abort()}},[itemId]);
 useEffect(()=>{if(!imageFile){setLocalAsset(null);return;}const url=URL.createObjectURL(imageFile);setLocalAsset(url);setFailedImage(false);return()=>URL.revokeObjectURL(url)},[imageFile]);
 const update=(p:Partial<Position>)=>{if(draft){setValue(v=>({...v,...p}));setError("")}};
 const pointerDown=(e:PointerEvent<HTMLDivElement>)=>{if(!draft||!(localAsset||item&&assetUrl(item.asset)))return;stage.current?.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,positionX:value.positionX,positionY:value.positionY}};
 const pointerMove=(e:PointerEvent<HTMLDivElement>)=>{if(!draft||!drag.current||!stage.current)return;const r=stage.current.getBoundingClientRect(),d=drag.current;
 update({positionX:Math.round(clamp(d.positionX+(e.clientX-d.x)/r.width,-1,1)*1000)/1000,
 positionY:Math.round(clamp(d.positionY+(e.clientY-d.y)/r.height,-1,1)*1000)/1000})};
 const save=async()=>{if(!item||!draft)return;setBusy(true);setError("");
 try{
  const asset=imageFile?await uploadItem(imageFile):(item.pendingDraft?.asset??item.asset);
  const body:ItemInput&{expectedRevision:number}={key:item.key,displayName:item.displayName,type:item.type,slot:item.slot,asset,...value,expectedRevision:item.revision};
  const updated=await writeItem("/"+item.id,"PATCH",body);setItem(updated);setValue(initial(updated));
  setImageFile(null);setLocalAsset(null);onChange?.();
 }catch(e){setError(e instanceof Error?e.message:"Không thể lưu Calibration.")}finally{setBusy(false)}};
 const transition=async(action:"publish"|"unpublish")=>{if(!item||!canManage)return;setBusy(true);setError("");
 try{const updated=await writeItem("/"+item.id+"/"+action,"POST",{expectedRevision:item.revision});setItem(updated);setValue(initial(updated));onChange?.()}
 catch(e){setError(e instanceof Error?e.message:"Không thể cập nhật trạng thái.")}finally{setBusy(false)}};
 if(!item)return <p role={error?"alert":"status"}>{error||"Đang tải Calibration…"}</p>;
 const src=localAsset||assetUrl(item.pendingDraft?.asset??item.asset);
 const edit=draft&&!busy;
 const num=(label:string,key:keyof Position,min:number,max:number,step:number)=> {
  const v=Number(value[key]??0);
  const change=(n:number)=>update({[key]:clamp(n,min,max)} as Partial<Position>);
  return <label className="ho-pi-cal-control" key={key}><span>{label}</span><div>
   <input aria-label={label} type="range" min={min} max={max} step={step} value={v} disabled={!edit} onChange={e=>change(Number(e.target.value))}/>
   <input aria-label={label+" giá trị"} type="number" min={min} max={max} step={step} value={v} disabled={!edit} onChange={e=>change(Number(e.target.value))}/>
  </div></label>
 };
 return <section className="ho-pinoria-items ho-pi-calibration" aria-label="Calibration Item">
  <div className="ho-pi-cal-layout">
   <div className="ho-pi-stage-column">
    <div className="ho-pi-stage" ref={stage} data-testid="ho-item-calibration-stage"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}
      aria-label="Canvas Calibration 9:16: nền R2 và ảnh Item đang chọn">
     <div className="ho-pi-stage-base" style={{opacity:baseVisible?opacity:0}}>
      <img className="ho-pi-char-base" src={BASE_URL} alt="Nhân vật nền Pinoria" draggable={false}/></div>
     {src&&!failedImage?<div className="ho-pi-layer" style={{transform:"translate("+(value.positionX*100)+"%,"+(value.positionY*100)+"%) scale("+value.scale+") rotate("+(value.rotationDegrees??0)+"deg)"}}>
       <img className="ho-pi-layer-image" src={src} alt={"Asset "+item.displayName} draggable={false} onError={()=>setFailedImage(true)}/></div>:null}
     {!src||failedImage?<p className="ho-pi-stage-missing" role="status">{failedImage?"Asset R2 chưa thể hiển thị. Kiểm tra đường dẫn media thật.":"Item chưa có ảnh khả dụng."}</p>:null}
    </div>
    <div className="ho-pi-base-controls"><button className="secondary-btn" type="button" onClick={()=>setBaseVisible(v=>!v)}>{baseVisible?"Ẩn":"Hiện"} nền</button>
     <label>Độ mờ nền <input aria-label="Độ mờ nền" type="range" min="0" max=".7" step=".05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label></div>
    {draft?<label className="ho-pi-upload">Thay ảnh Item (PNG/WebP, tối đa 10MB)
      <input type="file" accept="image/png,image/webp" disabled={busy} onChange={e=>setImageFile(e.target.files?.[0]??null)}/></label>:null}
   </div>
   <div className="ho-pi-cal-tools">
    <div className="ho-pi-cal-heading"><div><h3>Calibration · Item</h3><p>{item.displayName} · {slotNames[item.slot]}. Layer order cố định theo renderer.</p></div>
     <span className="datatag">Revision {item.revision}</span></div>
    {item.status!=="DRAFT"?<p className="ho-pi-warning">{item.status==="PUBLISHED"?(item.pendingDraft?"Bản Published vẫn giữ nguyên cho đến khi Publish Revision. Bạn đang xem bản chỉnh sửa chưa công bố.":"Bản Published đang được hiển thị; chỉnh Calibration và lưu để tạo bản nháp mới, chưa thay đổi bản công bố."):"Item đã Unpublish: Core V1 không cho sửa bản này."}</p>:null}
    {num("Vị trí ngang (X)","positionX",-1,1,.01)}
    {num("Vị trí dọc (Y)","positionY",-1,1,.01)}
    {num("Kích thước (Scale)","scale",.2,2.5,.05)}
    <button type="button" className="ho-pi-advanced" aria-expanded={advanced} onClick={()=>setAdvanced(a=>!a)}>Nâng cao · Xoay {advanced?"▴":"▾"}</button>
    {advanced?num("Xoay (Rotation)","rotationDegrees",-360,360,1):null}
    <div className="ho-pi-cal-actions">
     <button className="secondary-btn" type="button" disabled={!edit} onClick={()=>update(initial(item))}>Reset Calibration</button>
     <button className="primary-btn" type="button" disabled={!edit} onClick={save}>{busy?"Đang lưu…":"Lưu Calibration"}</button>
     {(item.status==="DRAFT"||item.status==="PUBLISHED"&&item.pendingDraft)&&canManage?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>transition("publish")}>{item.status==="PUBLISHED"?"Publish Revision":"Publish"}</button>:null}
     {item.status==="PUBLISHED"&&!item.pendingDraft&&canManage?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>transition("unpublish")}>Unpublish</button>:null}
     <button className="secondary-btn" type="button" disabled={busy} onClick={()=>void read().catch(()=>setError("Không thể tải lại Item."))}>Tải lại</button>
    </div>
    {error?<p role="alert">{error}</p>:null}
    {!canManage?<p role="status">Chỉ có quyền xem; không thể lưu Calibration.</p>:null}
    <small>X/Y theo từng trục canvas 9:16. Với Item Published, Lưu chỉ tạo draft revision, không đổi bản đang công bố; Publish Revision mới cập nhật bản đó. Khi CAS 409 phải tải lại.</small>
   </div>
  </div>
 </section>;
}
