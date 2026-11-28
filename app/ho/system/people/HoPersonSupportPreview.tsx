"use client";
/** PAP-1523: synthetic support tab; no session, request, redirect, storage or credential. */
import {useEffect,useId,useState} from "react";
import "@pino/design-system/bo-tokens.css";
import {BoActionButton,BoActionGroup} from "@pino/design-system/react";
import {previewRemainingSeconds,startSupportPreview,SUPPORT_FIXTURE_ID,supportPreviewTargets,type PreviewSession} from "./person-support-preview";

export function HoPersonSupportPreview({personId,personName}:{personId:string;personName:string}){
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
  const reset=()=>{setSession(null);setTarget("");setReason("");};
  const start=()=>{
    const next=startSupportPreview(personId,target,reason,Date.now());
    if(!next)return;
    setSeconds(previewRemainingSeconds(next,Date.now()));
    setSession(next);
  };
  return <section data-pino-ds="bo" className="pds-property-section" aria-labelledby={heading} data-testid="pap1523-view-launcher">
    <div className="pds-compact-card">
      <div className="pds-compact-heading"><h3 id={heading}>Phiên hỗ trợ</h3><span className="datatag blue">VIEW ONLY</span></div>
      <p className="pds-compact-muted">Chỉ xem theo quyền của Person. Không thay đổi dữ liệu.</p>
      <p role="status" className="pds-compact-muted">M1 · Mô phỏng giao diện, không mở ứng dụng hoặc phiên đăng nhập thật.</p>
      {session?<div className="pds-property-section" role="region" aria-label="Phiên hỗ trợ mô phỏng">
        <h4 className="pds-property-heading">VIEW AS · {personName}</h4>
        <ul className="pds-compact-list">
          <li><span>Ứng dụng</span><strong>{session.target.surface}</strong></li>
          <li><span>Vai trò</span><strong>{session.target.actor}</strong></li>
          <li><span>Phạm vi</span><strong>{session.target.scope}</strong></li>
          <li><span>Thời hạn</span><strong>Chỉ xem · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")} còn lại</strong></li>
        </ul>
        <BoActionGroup className="tdd-action-host"><BoActionButton variant="secondary" type="button" onClick={reset}>Kết thúc phiên hỗ trợ</BoActionButton></BoActionGroup>
      </div>:<div role="group" aria-label="Thông tin phiên hỗ trợ" className="pds-property-section">
        <div className="pds-property-grid">
          <div className="pds-property-row"><label className="pds-property-label" htmlFor={targetLabel}>Ứng dụng và vai trò</label>
            <select className="pds-property-input" id={targetLabel} value={target} onChange={event=>setTarget(event.target.value)} required>
              <option value="">Chọn trải nghiệm</option>
              {supportPreviewTargets.map(item=><option key={item.id} value={item.id} disabled={!item.eligible}>
                {item.surface} · {item.actor} · {item.scope}{item.unavailableReason?" — "+item.unavailableReason:""}
              </option>)}
            </select>
          </div>
          {selected&&<div className="pds-property-row"><span className="pds-property-label">Phạm vi</span><span className="pds-property-value">{selected.scope} · Chỉ xem</span></div>}
          <div className="pds-property-row"><label className="pds-property-label" htmlFor={reasonLabel}>Lý do hỗ trợ</label>
            <textarea className="pds-property-input" id={reasonLabel} required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} rows={3} placeholder="Nhập lý do hỗ trợ"/>
          </div>
        </div>
        <BoActionGroup className="tdd-action-host"><BoActionButton variant="secondary" type="button" onClick={reset}>Hủy</BoActionButton>
          <BoActionButton variant="primary" type="button" onClick={start} disabled={!selected||!reason.trim()}>Mở phiên xem</BoActionButton></BoActionGroup>
      </div>}
    </div>
  </section>;
}
