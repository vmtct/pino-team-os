/** PAP-2172 — BO Post Draft Private Media M1. Content-only native TDD slot.
 * No network requests or production registration. Host supplies isolated preview state. */
import type {ChangeEvent,ReactNode} from "react";
export const PRIVATE_MEDIA_MAX_COUNT=5;
export const PRIVATE_MEDIA_MAX_BYTES=5*1024*1024;
export const PRIVATE_MEDIA_TYPES=["image/jpeg","image/png","image/webp"] as const;
export type PrivateMediaRow={id:string;name:string;bytes:number;state:"ready"|"pending"|"error"};
export type PrivateMediaShellState=
 |{status:"loading"|"denied"|"error"}
 |{status:"ready";rows:readonly PrivateMediaRow[];canEdit:boolean;busy:boolean;error?:string;preview?:{id:string;url:string}};
export function validatePrivateMediaSelection(files:readonly Pick<File,"type"|"size">[],count:number):string|null{
 if(!Number.isSafeInteger(count)||count<0||count>PRIVATE_MEDIA_MAX_COUNT||files.length===0||count+files.length>PRIVATE_MEDIA_MAX_COUNT)return "Tối đa 5 ảnh cho mỗi Post.";
 if(files.some(f=>!(PRIVATE_MEDIA_TYPES as readonly string[]).includes(f.type)))return "Chỉ hỗ trợ JPEG, PNG và WebP.";
 if(files.some(f=>!Number.isSafeInteger(f.size)||f.size<=0||f.size>PRIVATE_MEDIA_MAX_BYTES))return "Mỗi ảnh phải có dung lượng lớn hơn 0 và không quá 5 MB.";
 return null;
}
export type PrivateMediaShellActions={select:(files:readonly File[])=>void;preview:(id:string)=>void;closePreview:()=>void;remove:(id:string)=>void;retry:()=>void};
/** Return direct native markup rather than a nested shell or competing renderer. */
export function privateMediaSlot(state:PrivateMediaShellState,actions:PrivateMediaShellActions):ReactNode{
 if(state.status==="loading")return <p role="status">Đang tải ảnh…</p>;
 if(state.status==="denied")return <p role="status">Bạn chưa có quyền xem ảnh của Post này.</p>;
 if(state.status==="error")return <section className="v24-prop-section piner-post-private-media"><p role="alert">Không thể tải ảnh.</p><button type="button" className="secondary-btn" onClick={actions.retry}>Thử lại</button></section>;
 if(state.status!=="ready")return null;
 const {rows,canEdit,busy,preview}=state;
 const selected=preview&&rows.find(row=>row.id===preview.id&&row.state==="ready");
 const select=(event:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value="";if(canEdit&&!busy&&rows.length<PRIVATE_MEDIA_MAX_COUNT&&files.length)actions.select(files);};
 return <section className="v24-prop-section piner-post-private-media">
  <div className="v24-section-heading"><h4>Media của Post ({rows.length}/{PRIVATE_MEDIA_MAX_COUNT})</h4></div>
  {canEdit?<div><label className="secondary-btn piner-post-media-picker" aria-disabled={busy||rows.length>=PRIVATE_MEDIA_MAX_COUNT}>Thêm ảnh<input aria-label="Thêm ảnh" type="file" accept={PRIVATE_MEDIA_TYPES.join(",")} multiple disabled={busy||rows.length>=PRIVATE_MEDIA_MAX_COUNT} onChange={select}/></label><p>JPEG, PNG, WebP · Tối đa 5 ảnh · 5 MB/ảnh</p></div>:null}
  {state.error?<p role="alert">{state.error}</p>:null}
  {busy?<p role="status">Đang xử lý ảnh…</p>:null}
  {rows.length===0?<p>Chưa có ảnh.</p>:<ul>{rows.map(row=><li key={row.id}><span>{row.name} · {Math.ceil(row.bytes/1024)} KB{row.state==="pending"?" · Đang xử lý":row.state==="error"?" · Lỗi":""}</span>{" "}{row.state==="ready"?<button type="button" className="secondary-btn" onClick={()=>actions.preview(row.id)}>Xem ảnh</button>:null}{" "}{canEdit?<button type="button" className="secondary-btn" disabled={busy} aria-label={"Gỡ "+row.name} onClick={()=>{if(!busy)actions.remove(row.id);}}>Gỡ ảnh</button>:null}</li>)}</ul>}
  {selected&&preview&&/^blob:/.test(preview.url)?<section><div><strong>{selected.name}</strong>{" "}<button type="button" className="secondary-btn" onClick={actions.closePreview}>Đóng ảnh</button></div><picture className="piner-post-media-preview"><img src={preview.url} alt={selected.name} width={320} height={240}/></picture></section>:null}
 </section>;
}
