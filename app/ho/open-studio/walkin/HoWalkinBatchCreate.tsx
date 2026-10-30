"use client";
import {useEffect,useRef,useState} from "react";
import {TosButton,TosCard} from "@pino/design-system/react";
import type {WalkinPass} from "./schema";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type BatchReceipt={id:string;name:string;quantity:number};
/** PAP-1166: explicitly manual Founder-only batch command; canonical HO shell/TDD stays in charge. */
export function HoWalkinBatchCreate({authorized,onVerified}:{authorized:boolean;onVerified:()=>void}){
 const [open,setOpen]=useState(false);
 const [name,setName]=useState("");
 const [qty,setQty]=useState("10");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [needsReadback,setNeedsReadback]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const locked=useRef(false);
 useEffect(()=>{
  const el=dialog.current;if(!el)return;
  if(open&&!el.open)el.showModal();
  if(!open&&el.open)el.close();
 },[open]);
 const quantity=Number(qty);
 const valid=Boolean(name.trim()&&name.trim().length<=90&&Number.isInteger(quantity)&&quantity>=1&&quantity<=100);
 function dismiss(){if(busy)return;setOpen(false);setError("");}
 async function create(){
  if(!authorized||busy||locked.current||!valid||needsReadback)return;
  locked.current=true;setBusy(true);setError("");setNotice("");
  const wanted={name:name.trim(),quantity};
  try{
   const response=await fetch("/api/ho/open-studio/walkin/batches",{
    method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
    body:JSON.stringify(wanted),
   });
   if([401,403,404].includes(response.status))throw Error("Tài khoản không có quyền GLOBAL tạo batch.");
   if(!response.ok)throw Error("Core chưa xác nhận tạo batch; kiểm tra kho trước khi thử lại.");
   const payload:unknown=await response.json();
   if(!payload||typeof payload!=="object"||!("data" in payload))throw Error("Receipt không hợp lệ.");
   const receipt=payload.data as BatchReceipt;
   if(!receipt||!uuid.test(receipt.id)||receipt.name!==wanted.name||receipt.quantity!==wanted.quantity)
    throw Error("Thông tin batch từ Core không khớp yêu cầu.");
   // Confirm actual batch identities in source of truth, not just HTTP success.
   const check=await fetch("/api/ho/open-studio/walkin/inventory?limit=100",{
    method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error"
   });
   if(!check.ok)throw Error("Chưa tải được inventory để kiểm tra batch vừa tạo.");
   const result:unknown=await check.json();
   if(!result||typeof result!=="object"||!("data" in result)||!Array.isArray(result.data))
    throw Error("Inventory Core không có dữ liệu hợp lệ.");
   const actual=(result.data as WalkinPass[]).filter(p=>p.batch_id===receipt.id);
   if(actual.length!==quantity||new Set(actual.map(p=>p.code)).size!==quantity||
     actual.some(p=>p.status!=="AVAILABLE"||p.path_code!==null||p.center_id!==null||p.parent_user_id!==null))
    throw Error("Chưa xác minh đủ số Pass của batch; cần kiểm tra trước khi tạo lại.");
   setNotice("Đã tạo và kiểm chứng "+quantity+" mã Pass trong Core.");
   setOpen(false);setName("");setQty("10");
   onVerified();
  }catch(cause){
   setError((cause instanceof Error?cause.message:"Chưa xác minh kết quả.")+" Không gửi lại yêu cầu trước khi đối chiếu Core.");
   setNeedsReadback(true);
  }finally{locked.current=false;setBusy(false);}
 }
 return <div className="ho-walkin-controls">
  <TosCard><div className="ho-walkin-controls-row">
   <div><h2>Kho Pass · Trạm Nghệ Thuật</h2><p>HO quản lý mã Pass một lượt. Chỉ Founder được tạo batch mới; không thu tiền hoặc gửi e-pass tự động.</p></div>
   <TosButton type="button" variant="primary" disabled={!authorized} onClick={()=>{setError("");setOpen(true)}}>
    ＋ Tạo batch
   </TosButton>
  </div></TosCard>
  {notice&&<p role="status">{notice}</p>}
  {needsReadback&&<p role="alert">{error} <button type="button" onClick={()=>location.reload()}>Tải lại kho trước khi thao tác khác</button></p>}
  <dialog ref={dialog} className="ho-walkin-batch-dialog" aria-labelledby="ho-walkin-dialog-title"
   onClose={()=>setOpen(false)} onCancel={event=>{if(busy){event.preventDefault();return;}setOpen(false);}}>
   <TosCard><form method="dialog" onSubmit={e=>{e.preventDefault();void create();}}>
    <h2 id="ho-walkin-dialog-title">Tạo batch Pass mới</h2>
    <p>Mỗi mã chỉ sử dụng một lượt; tồn kho ban đầu là AVAILABLE, chưa gắn Parent hoặc Center.</p>
    <div className="property-row">
     <label className="property-label" htmlFor="ho-walkin-name">Tên batch</label>
     <input id="ho-walkin-name" maxLength={90} required autoFocus value={name}
      disabled={busy||needsReadback} onChange={e=>setName(e.target.value)}/>
    </div>
    <div className="property-row">
     <label className="property-label" htmlFor="ho-walkin-quantity">Số Pass (1–100)</label>
     <input id="ho-walkin-quantity" type="number" min={1} max={100} step={1} required value={qty}
      disabled={busy||needsReadback} onChange={e=>setQty(e.target.value)}/>
    </div>
    <p>Batch được ghi vào Core/D1; không thể dùng dữ liệu giả hoặc tạo mã tại trình duyệt.</p>
    {error&&<p role="alert">{error}</p>}
    <div className="staff-actions">
     <TosButton type="button" variant="secondary" disabled={busy} onClick={dismiss}>Đóng</TosButton>
     <TosButton type="submit" variant="primary" disabled={!authorized||busy||!valid||needsReadback}>
      {busy?"Đang kiểm chứng…":"Xác nhận tạo batch"}
     </TosButton>
    </div>
   </form></TosCard>
  </dialog>
 </div>;
}
