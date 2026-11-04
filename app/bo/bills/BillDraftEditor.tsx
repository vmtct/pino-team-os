"use client";
import {useEffect,useRef,useState} from "react";
import {boApi} from "@/lib/bo-api";
import {BoApiError} from "@/lib/bo-api-error";
import {billsApi,billError,draftTotal,type BillDraft,type BillDraftLine,type DraftLineInput,type IssuePreview} from "@/lib/bo-bills-api";
import {readScopedParentDirectory} from "../parents/provider";
import {studentCenterApi} from "@/lib/bo-student-center-api";
import {useBoDialog} from "../components/registration/useBoDialog";
import type {BoSubscriptionDirectoryItem} from "@/lib/bo-model";

type Command={run:()=>Promise<unknown>;reconcile?:()=>Promise<void>};
export function BillDraftEditor({centerId,id,onClose,onSaved}:{centerId:string;id?:string;onClose:()=>void;onSaved:()=>void}){
 const [draft,setDraft]=useState<BillDraft|null>(null),[parents,setParents]=useState<{id:string;name:string}[]>([]),[payer,setPayer]=useState("");
 const [discount,setDiscount]=useState("0"),[due,setDue]=useState(""),[note,setNote]=useState("");
 const [query,setQuery]=useState(""),[candidates,setCandidates]=useState<BoSubscriptionDirectoryItem[]>([]),[candidate,setCandidate]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [preview,setPreview]=useState<IssuePreview|null>(null),[reload,setReload]=useState(0),[uncertain,setUncertain]=useState(false);
 const panel=useRef<HTMLElement>(null),fence=useRef(false),pending=useRef<Command|null>(null);
 const close=()=>{if(!fence.current&&!pending.current)onClose();};
 useBoDialog(true,close,panel);
 function accept(d:BillDraft){setDraft(d);setPayer(d.payerParentUserId);setDiscount(String(d.billDiscountMinor));setDue(d.dueOn??"");setNote(d.note);setPreview(null);}
 useEffect(()=>{let live=true;const ctl=new AbortController();
  void (async()=>{try{if(id){const d=await billsApi.get(centerId,id,ctl.signal);if(live)accept(d);}else{const rows=await readScopedParentDirectory(centerId,fetch,ctl.signal);if(live)setParents(rows.map(r=>({id:r.id,name:String(r.name)})));}}
   catch(e){if(live)setError(billError(e));}finally{if(live)setLoading(false);}})();
  return()=>{live=false;ctl.abort();};
 },[centerId,id,reload]);
 async function execute(command:Command){
  if(fence.current)return;fence.current=true;setBusy(true);setError("");setNotice("");setPreview(null);
  const attempt=pending.current??command;pending.current=attempt;
  try{await attempt.run();if(attempt.reconcile)await attempt.reconcile();pending.current=null;setUncertain(false);setNotice("Đã đọc lại dữ liệu đã lưu.");onSaved();}
  catch(e){setError(billError(e));const definite=e instanceof BoApiError&&e.structuredResponse&&e.status>=400&&e.status<500;if(definite){pending.current=null;setUncertain(false);}else setUncertain(true);}
  finally{fence.current=false;setBusy(false);}
 }
 const editable=!loading&&!busy&&!uncertain&&draft?.status!=="ISSUED";
 async function saveTerms(){
  const amount=Number(discount);if(!Number.isSafeInteger(amount)||amount<0){setError("Giảm giá phải là số nguyên không âm.");return;}
  const terms={billDiscountMinor:amount,dueOn:due||null,note};
  if(draft){const current=draft;await execute({run:async()=>{await billsApi.update(centerId,current.id,terms,current.version);accept(await billsApi.get(centerId,current.id));}});}
  else {const key=crypto.randomUUID();await execute({run:async()=>{const d=await billsApi.create(centerId,payer,terms,key);accept(await billsApi.get(centerId,d.id));}});}
 }
 async function searchSubscriptions(){
  if(!draft||fence.current)return;fence.current=true;setBusy(true);setError("");setCandidates([]);setCandidate("");
  try{const page=await boApi.subscriptionDirectory({centerId,query,limit:25});
   const matched:BoSubscriptionDirectoryItem[]=[];
   for(const s of page.items){if(!s.productPlanId||s.listPriceMinor===null||draft.items.some(i=>i.subscriptionId===s.id))continue;
    const life=await studentCenterApi.learnerLifecycle(s.studentProfileId,centerId);
    if(life.guardians.some(g=>g.parent.id===draft.payerParentUserId&&g.parent.status==="ACTIVE")&&life.subscriptions.some(x=>x.subscription.id===s.id))matched.push(s);
   }
   setCandidates(matched);setNotice(matched.length?"Chọn Subscription; Core xác minh điều kiện khi lưu.":"Không có Subscription phù hợp trong kết quả. Thử từ khóa khác.");
  }catch(e){setError(billError(e));}finally{fence.current=false;setBusy(false);}
 }
 async function add(){const s=candidates.find(v=>v.id===candidate);if(!s||!draft||s.listPriceMinor===null)return;
  const current=draft,key=crypto.randomUUID();await execute({run:async()=>{await billsApi.addLine(centerId,current.id,s.id,{unitPriceMinor:s.listPriceMinor!,discountAmountMinor:0,descriptionSnapshot:s.studentDisplayName+" · "+s.pathDisplayName},current.version,key);accept(await billsApi.get(centerId,current.id));setCandidates([]);setCandidate("");}});
 }
 async function editLine(line:BillDraftLine,value:DraftLineInput){if(!draft)return;const d=draft;await execute({run:async()=>{await billsApi.editLine(centerId,d.id,line.id,value,d.version);accept(await billsApi.get(centerId,d.id));}});}
 async function remove(line:BillDraftLine){if(!draft)return;const d=draft;await execute({run:async()=>{await billsApi.removeLine(centerId,d.id,line.id,d.version);accept(await billsApi.get(centerId,d.id));}});}
 async function preflight(){if(!draft||fence.current)return;fence.current=true;setBusy(true);setError("");try{const p=await billsApi.preview(centerId,draft.id);if(p.expectedVersion!==draft.version)throw new BoApiError(409,"Draft đã thay đổi.",null);setPreview(p);}catch(e){setError(billError(e));}finally{fence.current=false;setBusy(false);}}
 async function issue(){if(!draft||!preview?.preflightPass)return;const d=draft,key=crypto.randomUUID();await execute({run:async()=>{await billsApi.issue(centerId,d.id,preview.expectedVersion,key);},reconcile:async()=>{const next=await billsApi.get(centerId,d.id);if(next.status!=="ISSUED"||!next.issuedBillId)throw Error("Chưa xác minh Bill đã phát hành.");accept(next);}});}
 return <><div className="drawer-scrim visible" aria-hidden="true" onClick={close}/><aside ref={panel} className="drawer open" role="dialog" aria-modal="true" aria-labelledby="bill-editor-title">
  <div className="drawer-top"><div className="drawer-header-copy"><span className="drawer-path">Tài chính · Bills</span><h2 id="bill-editor-title" className="drawer-record-title">{draft?.status==="ISSUED"?"Bill đã phát hành":draft?"Sửa Bill Draft":"Tạo Bill"}</h2></div><button type="button" className="drawer-close" aria-label="Đóng" disabled={busy||uncertain} onClick={close}>×</button></div>
  <div className="drawer-content">
   {loading?<p role="status">Đang tải Bill…</p>:null}
   {error?<p className="edit-error" role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
   {uncertain?<p role="alert">Chưa xác minh kết quả. Giữ nguyên lệnh để thử lại an toàn.</p>:null}
   <fieldset disabled={!editable}><legend>Phụ huynh thanh to?n</legend>
    {draft?<p>{draft.payerParentUserId}</p>:<label className="property-row">Phụ huynh<select aria-label="Phụ huynh" value={payer} onChange={e=>setPayer(e.target.value)}><option value="">Ch?n phụ huynh</option>{parents.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label className="property-row">Giảm giá Bill (VND)<input type="number" min="0" step="1" value={discount} onChange={e=>{setDiscount(e.target.value);setPreview(null);}}/></label>
    <label className="property-row">Hạn thanh toán<input type="date" value={due} onChange={e=>{setDue(e.target.value);setPreview(null);}}/></label>
    <label className="property-row">Ghi chú<textarea maxLength={2000} value={note} onChange={e=>{setNote(e.target.value);setPreview(null);}}/></label>
    <button className="secondary-btn" type="button" disabled={!payer} onClick={()=>void saveTerms()}>Lưu Draft</button>
   </fieldset>
   {draft?<><section className="property-section"><h3>Subscriptions · số lượng 1</h3>{draft.items.map(line=><DraftLine key={line.id+":"+draft.version} line={line} disabled={!editable} onSave={v=>void editLine(line,v)} onRemove={()=>void remove(line)}/>)}
    {draft.items.length===0?<p>Chưa có Subscription.</p>:null}
    {draft.status==="DRAFT"?<fieldset disabled={!editable}><legend>Thêm Subscription</legend><label className="property-row">Tìm học viên / Subscription<input value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" className="secondary-btn" onClick={()=>void searchSubscriptions()}>Tìm Subscription</button>
    <label className="property-row">Subscription<select value={candidate} onChange={e=>setCandidate(e.target.value)}><option value="">Chọn Subscription</option>{candidates.map(s=><option key={s.id} value={s.id}>{s.studentDisplayName} ₫ {s.pathDisplayName} ₫ {s.id}</option>)}</select></label><button type="button" className="secondary-btn" disabled={!candidate} onClick={()=>void add()}>Thêm vào Draft</button></fieldset>:null}
   </section><p>Tổng Draft đã lưu: {draftTotal(draft).toLocaleString("vi-VN")} ₫</p></>:null}
   {preview?<section aria-label="Xác nhận phát hành"><h3>Phát hành Bill?</h3><p>{preview.lineCount} Subscription ? {preview.netAmountMinor.toLocaleString("vi-VN")} ₫. Giá và điều kiện đã lưu sẽ được cố định.</p>{preview.blockers.length?<p role="alert">Chưa thể phát hành: {preview.blockers.join(", ")}</p>:<button className="primary-btn" type="button" disabled={busy||uncertain} onClick={()=>void issue()}>Xác nhận phát hành</button>}</section>:null}
  </div><div className="drawer-footer"><div className="lab-bottom"><button className="secondary-btn" type="button" disabled={busy||uncertain} onClick={close}>Đóng</button>
   {uncertain?<button type="button" className="primary-btn" disabled={busy} onClick={()=>{if(pending.current)void execute(pending.current);}}>Thử lại cùng lệnh</button>:draft?.status==="DRAFT"?<><button type="button" className="secondary-btn" disabled={busy} onClick={()=>{setLoading(true);setPreview(null);setReload(n=>n+1);}}>Tải lại</button><button className="primary-btn" type="button" disabled={busy||!draft.items.length||discount!==String(draft.billDiscountMinor)||due!==(draft.dueOn??"")||note!==draft.note} onClick={()=>void preflight()}>Phát hành…</button></>:null}
  </div></div>
 </aside></>;
}
function DraftLine({line,disabled,onSave,onRemove}:{line:BillDraftLine;disabled:boolean;onSave:(v:DraftLineInput)=>void;onRemove:()=>void}){
 const [price,setPrice]=useState(String(line.unitPriceMinor)),[discount,setDiscount]=useState(String(line.discountAmountMinor));
 const valid=Number.isSafeInteger(Number(price))&&Number(price)>=0&&Number.isSafeInteger(Number(discount))&&Number(discount)>=0&&Number(discount)<=Number(price);
 return <fieldset disabled={disabled}><legend>{line.descriptionSnapshot}</legend><p>{line.subscriptionId} · SL 1</p><label className="property-row">Học phí thỏa thuận (VND)<input type="number" min="0" step="1" value={price} onChange={e=>setPrice(e.target.value)}/></label><label className="property-row">Giảm giá (VND)<input type="number" min="0" step="1" max={price} value={discount} onChange={e=>setDiscount(e.target.value)}/></label><button className="secondary-btn" type="button" disabled={!valid} onClick={()=>onSave({unitPriceMinor:Number(price),discountAmountMinor:Number(discount),descriptionSnapshot:line.descriptionSnapshot})}>Lưu dòng</button> <button className="secondary-btn" type="button" onClick={onRemove}>Bỏ dòng khỏi Draft</button></fieldset>;
}
