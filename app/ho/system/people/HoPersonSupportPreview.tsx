"use client";
/** PAP-1523: synthetic launcher only; no live session, request, redirect, storage or credential. */
import {useEffect,useId,useState} from "react";
import {TosButton,TosCard} from "@pino/design-system/react";
import {previewRemainingSeconds,startSupportPreview,SUPPORT_FIXTURE_ID,supportPreviewTargets,type PreviewSession} from "./person-support-preview";

export function HoPersonSupportPreview({personId,personName}:{personId:string;personName:string}){
  const [open,setOpen]=useState(false);
  const [target,setTarget]=useState("");
  const [reason,setReason]=useState("");
  const [session,setSession]=useState<PreviewSession|null>(null);
  const [seconds,setSeconds]=useState(0);
  const targetLabel=useId(),reasonLabel=useId(),heading=useId();
  useEffect(()=>{
    if(!session)return;
    const interval=window.setInterval(()=>{
      const remaining=previewRemainingSeconds(session,Date.now());
      setSeconds(remaining);
      if(remaining===0)setSession(null);
    },1000);
    return ()=>window.clearInterval(interval);
  },[session]);
  if(personId!==SUPPORT_FIXTURE_ID)return null;
  const selected=supportPreviewTargets.find(x=>x.id===target&&x.eligible);
  const reset=()=>{setSession(null);setOpen(false);setTarget("");setReason("");};
  const start=()=>{
    const next=startSupportPreview(personId,target,reason,Date.now());
    if(!next)return;
    setSeconds(previewRemainingSeconds(next,Date.now()));
    setSession(next);
    setOpen(false);
  };
  return <TosCard><section aria-labelledby={heading} data-testid="pap1523-view-launcher">
    <h3 id={heading}>Hỗ trợ · View as</h3>
    <p>Chỉ xem theo quyền của Person. Không thay đổi dữ liệu.</p>
    <p role="status">M1 · Mô phỏng giao diện, không mở ứng dụng hoặc phiên đăng nhập thật.</p>
    {session?<div role="region" aria-label="Phiên hỗ trợ mô phỏng">
      <strong>VIEW AS · {personName}</strong>
      <p>{session.target.surface} · {session.target.actor} · {session.target.scope}</p>
      <p>Chỉ xem · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")} còn lại</p>
      <TosButton variant="secondary" onClick={reset}>Kết thúc phiên hỗ trợ</TosButton>
    </div>:open?<form onSubmit={event=>{event.preventDefault();start();}}>
      <p><label htmlFor={targetLabel}>Ứng dụng và vai trò</label></p>
      <select id={targetLabel} value={target} onChange={event=>setTarget(event.target.value)} required>
        <option value="">Chọn trải nghiệm</option>
        {supportPreviewTargets.map(item=><option key={item.id} value={item.id} disabled={!item.eligible}>
          {item.surface} · {item.actor} · {item.scope}{item.unavailableReason?" — "+item.unavailableReason:""}
        </option>)}
      </select>
      {selected&&<p>{selected.scope} · Chỉ xem</p>}
      <p><label htmlFor={reasonLabel}>Lý do hỗ trợ</label></p>
      <textarea id={reasonLabel} required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} rows={3}/>
      <p><TosButton variant="secondary" onClick={reset}>Hủy</TosButton>{" "}
      <TosButton variant="primary" disabled={!selected||!reason.trim()} onClick={start}>Mở phiên xem</TosButton></p>
    </form>:<TosButton variant="secondary" onClick={()=>setOpen(true)}>View as</TosButton>}
  </section></TosCard>;
}
