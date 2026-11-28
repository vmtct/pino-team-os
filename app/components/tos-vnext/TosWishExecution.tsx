"use client";
/** PAP-2031 / PNR-WISH — scope-pinned confirmation with a host-owned durable attempt fence. */
import {useEffect,useRef,useState} from "react";
import {TosVNextButton,TosVNextCard,TosVNextField,TosVNextSheet,TosVNextStatus} from "../tos-ds";
import {createWishAttempt,parseWishQuote,parseWishReceipt,prepareWishConfirmation,type WishAttempt,type WishDrawPayload} from "@/lib/pls-wish-tos-contract";
import type {CommittedWish} from "@/lib/pls-wish-reveal-contract";
import {TosWishReveal,type WishRevealLoader} from "./TosWishReveal";
import type {WishAttemptJournal} from "@/lib/pls-wish-attempt-journal";
import styles from "./reception-house.module.css";
type Scope=Pick<WishDrawPayload,"centerId"|"learnerId">;
/** Host must persist atomically, across unmount/reload, and deny concurrent attempts. No default memory-only journal. */
export type {WishAttemptJournal} from "@/lib/pls-wish-attempt-journal";
export type WishExecutionHost={quote:(scope:Scope,signal:AbortSignal)=>Promise<unknown>;draw:(attempt:WishAttempt)=>Promise<unknown>;journal:WishAttemptJournal;reveal?:WishRevealLoader};
type Props={centerId:string;learnerId:string;legalName:string;gender:"male"|"female"|null;host:WishExecutionHost;onCommitted?:()=>void};
type Confirmation=ReturnType<typeof prepareWishConfirmation>;
async function readAttempt(host:WishExecutionHost,scope:Scope){
 const a=await host.journal.read(scope);
 if(a&&(a.payload.centerId!==scope.centerId||a.payload.learnerId!==scope.learnerId))throw Error("Giao dịch chưa đối soát thuộc phạm vi khác.");
 return a?createWishAttempt(a.payload,a.key):null;
}
export function TosWishExecution(p:Props){return <WishExecution key={p.centerId+":"+p.learnerId} {...p}/>;}
function WishExecution({centerId,learnerId,legalName,gender,host,onCommitted}:Props){
 const [journalError,setJournalError]=useState("");
 const [attempt,setAttempt]=useState<WishAttempt|null>(null),[quote,setQuote]=useState<ReturnType<typeof parseWishQuote>|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[epoch,setEpoch]=useState(0);
 const [revision,setRevision]=useState(""),[count,setCount]=useState<number|"MAX">(1),[confirm,setConfirm]=useState<Confirmation|null>(null),[receipt,setReceipt]=useState<CommittedWish|null>(null),[busy,setBusy]=useState(false);
 const flight=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const attemptRef=useRef(attempt);
 const scope={centerId,learnerId};
 useEffect(()=>{
  const c=new AbortController();
  void (async()=>{let pending:WishAttempt|null;try{pending=await readAttempt(host,{centerId,learnerId});}catch(e){if(!c.signal.aborted)setJournalError(e instanceof Error?e.message:"Không thể kiểm tra giao dịch đang chờ.");return;}if(c.signal.aborted)return;setJournalError("");attemptRef.current=pending;setAttempt(pending);if(pending)return;try{const next=parseWishQuote(await host.quote({centerId,learnerId},c.signal),{centerId,learnerId});if(!c.signal.aborted){setQuote(next);setRevision(next.banners[0]?.bannerRevisionId??"");setCount(1);setError("");}}catch{if(!c.signal.aborted){setQuote(null);setError("Không thể tải cấu hình Wish.");}}})().finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>c.abort();
 },[centerId,learnerId,host,epoch]);
 const banner=quote?.banners.find(b=>b.bannerRevisionId===revision),n=count==="MAX"?banner?.maxCount??0:count;
 function refresh(){setLoading(true);setQuote(null);setConfirm(null);setEpoch(x=>x+1);}
 function prepare(){if(!quote||loading||attemptRef.current||journalError||flight.current)return;try{setConfirm(prepareWishConfirmation(quote,scope,revision,count));setError("");}catch(e){setError(e instanceof Error?e.message:"Không thể xác nhận Wish.");}}
 async function execute(c:Confirmation|null){
  if(flight.current||journalError)return;
  flight.current=true;setBusy(true);setError("");
  try{
   const persisted=await readAttempt(host,scope);if(!mounted.current)return;
   if(c&&persisted)throw Error("Một giao dịch khác đang chờ đối soát. Xác nhận lại đúng giao dịch này.");
   let a=attemptRef.current??persisted;
   if(a&&(!persisted||persisted.key!==a.key||JSON.stringify(persisted.payload)!==JSON.stringify(a.payload)))throw Error("Không xác minh được giao dịch đang chờ.");
   if(!a){if(!c||!quote||loading)throw Error("Tải lại báo giá.");const next=prepareWishConfirmation(quote,scope,revision,count);if(JSON.stringify(next)!==JSON.stringify(c))throw Error("Báo giá đã thay đổi.");a=createWishAttempt(c.payload);await host.journal.reserve(a);if(!mounted.current)return;}
   attemptRef.current=a;setAttempt(a);setConfirm(null);
   const raw=await host.draw(a);if(!mounted.current)return;
   setReceipt(parseWishReceipt(raw,a.payload));onCommitted?.();
  }catch(e){if(!mounted.current)return;setConfirm(null);setError((e instanceof Error?e.message:"Chưa xác minh giao dịch.")+" Không tạo giao dịch mới trước khi đối soát.");try{const pending=await readAttempt(host,scope);if(!mounted.current)return;attemptRef.current=pending;setAttempt(pending);setJournalError(pending?"":"Chưa xác minh được giữ chỗ giao dịch. Tải lại trước khi tiếp tục.");}catch{if(mounted.current)setJournalError("Không thể kiểm tra giao dịch đang chờ.");}}
  finally{flight.current=false;if(mounted.current)setBusy(false);}
 }
 async function done(){
  const a=attemptRef.current;if(!a||!receipt||flight.current)return;
  try{flight.current=true;setBusy(true);await host.journal.complete(a);if(!mounted.current)return;attemptRef.current=null;setAttempt(null);setReceipt(null);setError("");refresh();}
  catch{if(mounted.current)setError("Kết quả đã xác nhận nhưng chưa thể đóng giao dịch. Không tạo Wish mới.");}finally{flight.current=false;if(mounted.current)setBusy(false);}
 }
 if(receipt)return <><TosWishReveal key={receipt.eventId} receipt={receipt} centerId={centerId} learnerId={learnerId} load={host.reveal} onDone={done}/>{error&&<p role="alert" className={styles.error}>{error}</p>}</>;
 return <TosVNextCard className={styles.panel} aria-label="Wish học viên">
 <div className={styles.heading}><strong>Wish</strong><TosVNextStatus>PLS</TosVNextStatus></div>
 <div className={styles.selected}><span>Học viên được chọn</span><strong>{legalName}{gender==="male"?" ♂":gender==="female"?" ♀":""}</strong></div>
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 {journalError?<><p role="alert">{journalError}</p><TosVNextButton variant="secondary" disabled={loading||busy} onClick={refresh}>Tải lại để đối soát</TosVNextButton></>:attempt?<><p className={styles.help}>Có giao dịch {attempt.payload.count} Wish chưa đối soát. Chỉ kiểm tra lại bằng chính giao dịch này.</p><TosVNextButton disabled={busy||loading} onClick={()=>void execute(null)}>{busy?"Đang đối soát…":"Đối soát giao dịch"}</TosVNextButton></>:<>
 {loading?<p role="status">Đang tải số dư và Banner…</p>:quote?<><strong>{quote.balance} PLS</strong>{quote.status!=="READY"?<p role="status">{quote.status==="SELF_REQUIRED"?"Học viên chưa có Self.":quote.status==="OPEN_VISIT_REQUIRED"?"Cần check-in House trước khi Wish.":"Chưa có cấu hình Wish đang hoạt động."}</p>:<>
 <TosVNextField label="Banner"><select aria-label="Banner" value={revision} disabled={busy} onChange={e=>{setRevision(e.target.value);setCount(1);}}>{quote.banners.map(b=><option key={b.bannerRevisionId} value={b.bannerRevisionId}>{b.name}</option>)}</select></TosVNextField>
 {banner&&<><p>{banner.unitCost} PLS / Wish · Tối đa {banner.maxCount}</p><TosVNextField label="Số Wish"><select aria-label="Số Wish" disabled={busy||banner.maxCount===0} value={String(count)} onChange={e=>setCount(e.target.value==="MAX"?"MAX":Number(e.target.value))}>{Array.from({length:banner.maxCount},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}<option value="MAX">MAX ({banner.maxCount})</option></select></TosVNextField><p>Tổng: {n*banner.unitCost} PLS</p><TosVNextButton disabled={busy||n<1||n>banner.maxCount} onClick={prepare}>Wish</TosVNextButton></>}
 </>}</>:null}
 <TosVNextButton variant="secondary" disabled={loading||busy} onClick={refresh}>Tải lại</TosVNextButton>
 </>}
 {confirm&&<TosVNextSheet title="Xác nhận Wish" onClose={()=>{if(!flight.current)setConfirm(null);}}>
 <div className={styles.confirm}><strong>{legalName}</strong><p>{banner?.name} · {confirm.payload.count} Wish</p><p>Trừ {confirm.totalCost} PLS · Dự kiến còn {confirm.quotedBalance-confirm.totalCost} PLS</p>
 <TosVNextButton disabled={busy} onClick={()=>void execute(confirm)}>{busy?"Đang xác nhận…":"Xác nhận"}</TosVNextButton><TosVNextButton variant="secondary" disabled={busy} onClick={()=>setConfirm(null)}>Hủy</TosVNextButton></div>
 </TosVNextSheet>}
 </TosVNextCard>;
}
