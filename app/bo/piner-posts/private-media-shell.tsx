/** PAP-2172 / PAP-2337 — existing native Media slot with optional Diary Composer presentation. */
import type {ChangeEvent,ReactNode} from "react";
import type {ComposerSnapshot} from "./post-preview-session";
import styles from "./private-media-shell.module.css";
export const PRIVATE_MEDIA_MAX_COUNT=5;
export const PRIVATE_MEDIA_MAX_BYTES=5*1024*1024;
export const PRIVATE_MEDIA_TYPES=["image/jpeg","image/png","image/webp"] as const;
export type PrivateMediaRow={id:string;name:string;bytes:number;state:"ready"|"pending"|"error"};
export type PrivateMediaShellState=
 |{status:"loading"|"denied"|"error"}
 |{status:"ready";rows:readonly PrivateMediaRow[];canEdit:boolean;busy:boolean;error?:string;preview?:{id:string;url:string};composer?:ComposerSnapshot};
export function validatePrivateMediaSelection(files:readonly Pick<File,"type"|"size">[],count:number):string|null{
 if(!Number.isSafeInteger(count)||count<0||count>PRIVATE_MEDIA_MAX_COUNT||files.length===0||count+files.length>PRIVATE_MEDIA_MAX_COUNT)return "Tối đa 5 ảnh cho mỗi Post.";
 if(files.some(f=>!(PRIVATE_MEDIA_TYPES as readonly string[]).includes(f.type)))return "Chỉ hỗ trợ JPEG, PNG và WebP.";
 if(files.some(f=>!Number.isSafeInteger(f.size)||f.size<=0||f.size>PRIVATE_MEDIA_MAX_BYTES))return "Mỗi ảnh phải có dung lượng lớn hơn 0 và không quá 5 MB.";
 return null;
}
export type PrivateMediaShellActions={select:(files:readonly File[])=>void;preview:(id:string)=>void;closePreview:()=>void;remove:(id:string)=>void;retry:()=>void;toggleDiary?:(id:string)=>void;reorder?:(id:string,offset:number)=>void;sourceDiary?:(id:string)=>void};
/** Native content remains the single Media slot. Existing no-composer markup and controls retained. */
export function privateMediaSlot(state:PrivateMediaShellState,actions:PrivateMediaShellActions):ReactNode{
 if(state.status==="loading")return <p role="status">Đang tải ảnh…</p>;
 if(state.status==="denied")return <p role="status">Bạn chưa có quyền xem ảnh của Post này.</p>;
 if(state.status==="error")return <section className="v24-prop-section"><p role="alert">Không thể tải ảnh.</p><button type="button" className="secondary-btn" onClick={actions.retry}>Thử lại</button></section>;
 if(state.status!=="ready")return null;
 const {rows,canEdit,busy,preview,composer}=state;
 const selected=preview&&rows.find(row=>row.id===preview.id&&row.state==="ready");
 const image=(id:string)=>composer?.media.find(m=>m.id===id);
 const select=(event:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value="";if(canEdit&&!busy&&rows.length<PRIVATE_MEDIA_MAX_COUNT&&files.length)actions.select(files);};
 const add=<><button type="button" className="secondary-btn" disabled={busy||rows.length>=PRIVATE_MEDIA_MAX_COUNT} onClick={event=>{const input=event.currentTarget.nextElementSibling;if(input instanceof HTMLInputElement&&!input.disabled)input.click();}}>Thêm ảnh</button><input hidden aria-label="Thêm ảnh" type="file" accept={PRIVATE_MEDIA_TYPES.join(",")} multiple disabled={busy||rows.length>=PRIVATE_MEDIA_MAX_COUNT} onChange={select}/></>;
 const sourceLabel=(id?:string)=>composer?.diaries.find(d=>d.id===id)?.label??"Upload trực tiếp";
 const safeFixtureImage=selected&&image(selected.id)?.src;
 return <section className="v24-prop-section">
  <div className="v24-section-heading"><h4>Media của Post ({rows.length}/{PRIVATE_MEDIA_MAX_COUNT})</h4></div>
  {composer?<section aria-label="Diary nguồn"><div className="v24-section-heading"><h4>Diary nguồn</h4></div><div className={styles.diaryGrid}>{composer.diaries.map(d=><div key={d.id} className={styles.diaryCard}><img src={d.src} alt={"Ảnh gốc · "+d.label} width={160} height={120}/><label><input type="checkbox" checked={d.selected} disabled={!canEdit||busy||d.used||(!d.selected&&rows.length>=PRIVATE_MEDIA_MAX_COUNT)} onChange={()=>actions.toggleDiary?.(d.id)}/>{d.label}</label>{d.used?<small>{d.reason}</small>:<small>Ảnh gốc · sao chép từ menu ảnh</small>}</div>)}</div></section>:null}
  {canEdit?composer?<div className={styles.composer} aria-label="Ảnh đã chỉnh sửa"><label>Ảnh từ Diary<select className="property-control os-create-select" value={composer.sourceDiary} disabled={busy} onChange={e=>actions.sourceDiary?.(e.target.value)}><option value="">Upload trực tiếp</option>{composer.diaries.filter(d=>d.selected).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><div className={styles.attachments}>{composer.media.filter(m=>m.retouched).map(m=><div key={m.id} className={styles.attachment}><img src={m.src} alt={"Ảnh đã chỉnh sửa · "+sourceLabel(m.diaryId)} width={64}/><button type="button" className="secondary-btn" aria-label={"Gỡ ảnh đã chỉnh sửa "+m.id} disabled={busy} onClick={()=>actions.remove(m.id)}>×</button></div>)}</div><textarea className="property-control os-create-select" aria-label="Dán ảnh đã chỉnh sửa" placeholder="Dán ảnh (Ctrl+V) hoặc thêm ảnh" disabled={busy||rows.length>=PRIVATE_MEDIA_MAX_COUNT} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();actions.select(files);}}}/>{add}<p>JPEG, PNG, WebP · Tối đa 5 ảnh · 5 MB/ảnh</p></div>:<div>{add}<p>JPEG, PNG, WebP · Tối đa 5 ảnh · 5 MB/ảnh</p></div>:null}
  {state.error?<p role="alert">{state.error}</p>:null}
  {busy?<p role="status">Đang xử lý ảnh…</p>:null}
  {rows.length===0?<p>Chưa có ảnh.</p>:<div role="list" className={composer?styles.carousel:styles.stack}>{rows.map((row,i)=><div role="listitem" key={row.id} className={composer?styles.mediaCard:styles.row}>{composer&&image(row.id)?<img src={image(row.id)!.src} alt={row.name} width={160} height={120}/>:null}<span>{row.name} · {Math.ceil(row.bytes/1024)} KB{row.state==="pending"?" · Đang xử lý":row.state==="error"?" · Lỗi":""}{composer?" · "+sourceLabel(image(row.id)?.diaryId)+(image(row.id)?.retouched?" · Đã chỉnh sửa":""):""}</span>{" "}{row.state==="ready"?<button type="button" className="secondary-btn" onClick={()=>actions.preview(row.id)}>Xem ảnh</button>:null}{" "}{canEdit?<>{composer?<><button type="button" className="secondary-btn" disabled={busy||i===0} aria-label={"Chuyển "+row.name+" sang trái"} onClick={()=>actions.reorder?.(row.id,-1)}>←</button><button type="button" className="secondary-btn" disabled={busy||i===rows.length-1} aria-label={"Chuyển "+row.name+" sang phải"} onClick={()=>actions.reorder?.(row.id,1)}>→</button></>:null}<button type="button" className="secondary-btn" disabled={busy} aria-label={"Gỡ "+row.name} onClick={()=>{if(!busy)actions.remove(row.id);}}>Gỡ ảnh</button></>:null}</div>)}</div>}
  {selected&&preview&&(/^blob:/.test(preview.url)||(composer&&safeFixtureImage===preview.url&&/^data:image\/(png|jpeg|webp);base64,/.test(preview.url)))?<section><div><strong>{selected.name}</strong>{" "}<button type="button" className="secondary-btn" onClick={actions.closePreview}>Đóng ảnh</button></div><picture className={styles.preview}><img className={styles.image} src={preview.url} alt={selected.name} width={320} height={240}/></picture></section>:null}
 </section>;
}
