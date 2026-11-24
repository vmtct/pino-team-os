/** PAP-2172 / PAP-2337 — existing native Media slot with optional Diary Composer presentation. */
import type {ChangeEvent,ReactNode} from "react";
import type {ComposerSnapshot} from "./post-preview-session";
import styles from "./private-media-shell.module.css";
export const PRIVATE_MEDIA_MAX_COUNT=5;
export const PRIVATE_MEDIA_MAX_BYTES=5*1024*1024;
export const PRIVATE_MEDIA_TYPES=["image/jpeg","image/png","image/webp"] as const;
export type PrivateMediaRow={id:string;name:string;bytes:number;state:"ready"|"pending"|"error"};
export type PostReviewPresentation={caption:string;status:string;busy:boolean;error?:string;onSubmit?:()=>void;onEditCaption?:()=>void};
export type PrivateMediaShellState=
 |{status:"loading"|"denied"|"error"}
 |{status:"ready";rows:readonly PrivateMediaRow[];canEdit:boolean;busy:boolean;error?:string;preview?:{id:string;url:string};composer?:ComposerSnapshot;review?:PostReviewPresentation};
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
 if(composer){
  const review=state.review;
  const activeIndex=Math.max(0,rows.findIndex(r=>r.id===preview?.id));
  const active=rows[activeIndex],activeImage=active&&image(active.id);
  const caption=review?.caption?.trim()??"";
  const submitted=review?.status==="Chờ duyệt";
  return <section className="v24-prop-section" aria-label="Soạn bài đăng">
   <div className={styles.reviewGrid}>
    {canEdit?<div className={styles.sourceColumn}>
     <section aria-label="Diary nguồn"><div className="v24-section-heading"><h4>Diary nguồn</h4></div><div className={styles.diaryGrid}>{composer.diaries.map(d=><div key={d.id} className={styles.diaryCard}><img src={d.src} alt={"Ảnh gốc · "+d.label} width={160} height={120}/><label><input type="checkbox" checked={d.selected} disabled={busy||d.used||(!d.selected&&rows.length>=PRIVATE_MEDIA_MAX_COUNT)} onChange={()=>actions.toggleDiary?.(d.id)}/>{d.label}</label><small>{d.used?d.reason:"Ảnh gốc · sao chép từ menu ảnh"}</small></div>)}</div></section>
     <div className={styles.composer} aria-label="Ảnh đã chỉnh sửa"><label>Ảnh từ Diary<select className="property-control os-create-select" value={composer.sourceDiary} disabled={busy} onChange={e=>actions.sourceDiary?.(e.target.value)}><option value="">Upload trực tiếp</option>{composer.diaries.filter(d=>d.selected).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><div className={styles.attachments}>{composer.media.filter(m=>m.retouched).map(m=><div key={m.id} className={styles.attachment}><img src={m.src} alt={"Ảnh đã chỉnh sửa · "+sourceLabel(m.diaryId)} width={64}/><button type="button" className="secondary-btn" aria-label={"Gỡ ảnh đã chỉnh sửa "+m.id} disabled={busy} onClick={()=>actions.remove(m.id)}>×</button></div>)}</div><textarea className="property-control os-create-select" aria-label="Dán ảnh đã chỉnh sửa" placeholder="Dán ảnh (Ctrl+V) hoặc thêm ảnh" disabled={busy||rows.length>=PRIVATE_MEDIA_MAX_COUNT} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();actions.select(files);}}}/>{add}<small>JPEG, PNG, WebP · tối đa 5 MB/ảnh</small></div>
    </div>:<div className={styles.sourceColumn}><section aria-label="Diary nguồn"><div className="v24-section-heading"><h4>Diary nguồn đã chọn</h4></div><div className={styles.diaryGrid}>{composer.diaries.filter(d=>d.selected).map(d=><div className={styles.diaryCard} key={d.id}><img src={d.src} alt={"Ảnh gốc · "+d.label} width={160} height={120}/><span>{d.label}</span></div>)}</div></section></div>}
    <section className={styles.reviewCard} aria-label="Xem trước bài đăng">
     <div className={styles.reviewHeading}><div><h4>Xem trước bài đăng</h4><small>{rows.length}/{PRIVATE_MEDIA_MAX_COUNT} ảnh</small></div><span className={submitted?styles.pendingLabel:styles.draftLabel}>{submitted?"Chờ duyệt":"Nháp"}</span></div>
     {activeImage?<div className={styles.hero}><img src={activeImage.src} alt="Ảnh xem trước bài đăng" width={640} height={480}/><span className={styles.imageCounter}>{activeIndex+1}/{rows.length}</span>{activeIndex===0?<span className={styles.coverLabel}>Ảnh bìa</span>:null}</div>:<div className={styles.emptyHero}>Chưa có ảnh</div>}
     {rows.length>0?<div className={styles.filmstrip} role="list" aria-label="Thứ tự ảnh">{rows.map((row,i)=><div className={styles.filmItem} role="listitem" key={row.id}><button type="button" className={styles.filmThumb} aria-label={"Xem "+row.name} aria-pressed={i===activeIndex} onClick={()=>actions.preview(row.id)}>{image(row.id)?<img src={image(row.id)!.src} alt={row.name} width={84} height={64}/>:null}<span>{i+1}</span></button>{canEdit?<div className={styles.filmActions}><button type="button" className="secondary-btn" aria-label={"Chuyển "+row.name+" sang trái"} disabled={busy||i===0} onClick={()=>actions.reorder?.(row.id,-1)}>←</button><button type="button" className="secondary-btn" aria-label={"Chuyển "+row.name+" sang phải"} disabled={busy||i===rows.length-1} onClick={()=>actions.reorder?.(row.id,1)}>→</button><button type="button" className="secondary-btn" disabled={busy} aria-label={"Gỡ "+row.name} onClick={()=>actions.remove(row.id)}>×</button></div>:null}</div>)}</div>:null}
     {activeImage?<p className={styles.provenance}>{sourceLabel(activeImage.diaryId)} · {activeImage.retouched?"Đã chỉnh sửa":"Ảnh gốc"}</p>:null}
     <div className={styles.captionPreview}><strong>Caption</strong><p>{caption||"Chưa có caption."}</p>{canEdit&&review?.onEditCaption?<button type="button" className="secondary-btn" onClick={review.onEditCaption}>Sửa caption</button>:null}</div>
     {state.error||review?.error?<p role="alert" className={styles.reviewError}>{state.error||review?.error}</p>:null}
     {busy?<p role="status">Đang xử lý ảnh…</p>:null}
     <div className={styles.reviewFooter}>{submitted?<p role="status"><strong>Đã gửi duyệt</strong><small>Bài đăng đang chờ HO duyệt.</small></p>:<><p>{rows.length&&caption?"Sẵn sàng gửi duyệt":!rows.length?"Chọn ít nhất 1 ảnh":"Bổ sung caption"}</p>{canEdit&&review?.onSubmit?<button type="button" className="primary-btn" disabled={busy||review.busy||!caption||!rows.length} onClick={review.onSubmit}>Gửi duyệt</button>:null}</>}</div>
    </section>
   </div>
  </section>;
 }

 return <section className="v24-prop-section">
  <div className="v24-section-heading"><h4>Media của Post ({rows.length}/{PRIVATE_MEDIA_MAX_COUNT})</h4></div>
  {canEdit?<div>{add}<p>JPEG, PNG, WebP · Tối đa 5 ảnh · 5 MB/ảnh</p></div>:null}
  {state.error?<p role="alert">{state.error}</p>:null}
  {busy?<p role="status">Đang xử lý ảnh…</p>:null}
  {rows.length===0?<p>Chưa có ảnh.</p>:<div role="list" className={styles.stack}>{rows.map(row=><div role="listitem" key={row.id} className={styles.row}><span>{row.name} · {Math.ceil(row.bytes/1024)} KB{row.state==="pending"?" · Đang xử lý":row.state==="error"?" · Lỗi":""}</span>{" "}{row.state==="ready"?<button type="button" className="secondary-btn" onClick={()=>actions.preview(row.id)}>Xem ảnh</button>:null}{" "}{canEdit?<button type="button" className="secondary-btn" disabled={busy} aria-label={"Gỡ "+row.name} onClick={()=>{if(!busy)actions.remove(row.id);}}>Gỡ ảnh</button>:null}</div>)}</div>}
  {selected&&preview&&/^blob:/.test(preview.url)?<section><div><strong>{selected.name}</strong>{" "}<button type="button" className="secondary-btn" onClick={actions.closePreview}>Đóng ảnh</button></div><picture className={styles.preview}><img className={styles.image} src={preview.url} alt={selected.name} width={320} height={240}/></picture></section>:null}
 </section>;
}
