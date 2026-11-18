"use client";
/** PAP-2030 / PNR-WISH — shared DrawerFrame, explicit confirmation and exact receipt verification. */
import {useRef,useState} from "react";
import type {WishRevisionRef} from "@/lib/pls-wish-detail-route";
import {wishRevisionRef} from "./wish-catalog-state";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {publishWishDraft,retireWishRevision,confirmWishLifecycle,type WishLifecycleCommand,type WishConfigHead,type PolicyValue,type BannerValue} from "@/lib/pls-wish-ho-contract";
type Head=WishConfigHead<PolicyValue>|WishConfigHead<BannerValue>;
export type WishLifecycleHost=(command:WishLifecycleCommand)=>Promise<{receipt:unknown;readback:unknown}>;
type Props={scope:"policy"|"banner";head:Head;execute:WishLifecycleHost;onVerified:(next:WishRevisionRef)=>void;onReload:()=>void};
type Attempt={kind:"publish"|"retire";head:Head};
const signature=(h:Head)=>JSON.stringify([h.recordId,h.pointerVersion,h.active,h.latestDraft?.version,h.pendingDraft?.version,h.published?.id,h.staleDraft]);
export function HoWishLifecycle({scope,head,execute,onVerified,onReload}:Props){
 const [attempt,setAttempt]=useState<Attempt|null>(null),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[uncertain,setUncertain]=useState(false);
 const flight=useRef(false);
 const current=!!attempt&&signature(attempt.head)===signature(head);
 function open(kind:Attempt["kind"]){if(flight.current||uncertain)return;setAttempt({kind,head});setReason("");setError("");}
 function close(){if(!flight.current&&!uncertain){setAttempt(null);setError("");}}
 async function submit(){
  if(!attempt||!current||uncertain||flight.current)return;
  let cmd:WishLifecycleCommand;
  try{cmd=attempt.kind==="publish"?publishWishDraft(scope,attempt.head as WishConfigHead<PolicyValue|BannerValue>):retireWishRevision(scope,attempt.head as WishConfigHead<PolicyValue|BannerValue>,reason);}
  catch(e){setError(e instanceof Error?e.message:"Dữ liệu chưa hợp lệ.");return;}
  flight.current=true;setBusy(true);setError("");
  try{const result=await execute(cmd);const next=confirmWishLifecycle(cmd,attempt.head,result.receipt,result.readback);setAttempt(null);onVerified(wishRevisionRef(next,"published"));}
  catch(e){setUncertain(true);setError((e instanceof Error?e.message:"Chưa xác minh được kết quả.")+" Tải lại để đối soát; không gửi lại tự động.");}
  finally{flight.current=false;setBusy(false);}
 }
 return <>
 <div className="heading-actions">
 {head.pendingDraft&&!head.staleDraft&&<button type="button" className="primary-btn" disabled={busy||uncertain} onClick={()=>open("publish")}>Publish</button>}
 {head.active&&head.published&&<button type="button" className="secondary-btn" disabled={busy||uncertain} onClick={()=>open("retire")}>Retire</button>}
 </div>
 {attempt&&<DrawerFrame title={attempt.kind==="publish"?"Xác nhận Publish":"Xác nhận Retire"} path={scope==="policy"?"Wish Policies":"Wish Banners"} onClose={close}
 footer={<><button type="button" className="secondary-btn" disabled={busy||uncertain} onClick={close}>Hủy</button>{uncertain?<button type="button" className="primary-btn" disabled={busy} onClick={onReload}>Tải lại để đối soát</button>:<button type="button" className="primary-btn" disabled={busy||!current||(attempt.kind==="retire"&&!reason.trim())} onClick={()=>void submit()}>{busy?"Đang xử lý…":"Xác nhận"}</button>}</>}>
 <p><strong>{attempt.kind==="publish"?attempt.head.pendingDraft?.name:attempt.head.published?.name}</strong></p>
 <p>{attempt.kind==="publish"?"Publish bản nháp thành phiên bản bất biến đang hoạt động.":"Ngừng phiên bản đang hoạt động; giữ lịch sử và giao dịch cũ."}</p>
 {attempt.kind==="retire"&&<label>Lý do<textarea className="edit-input" required maxLength={1000} value={reason} disabled={busy||uncertain||!current} onChange={e=>setReason(e.target.value)}/></label>}
 {!current&&<p role="alert">Cấu hình đã thay đổi. Hủy và kiểm tra phiên bản mới.</p>}
 {error&&<p role="alert" className="edit-error">{error}</p>}
 </DrawerFrame>}
 </>;
}
