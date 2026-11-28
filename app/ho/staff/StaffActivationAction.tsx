"use client";
// PAP-2418 · WFM-STAFF. Injected presentation, no network or permissions.
import {useId,useRef,useState} from "react";
import {TosCard} from "@pino/design-system/react";
import {activationRequest,sameActivationRequest,verifiedActivation,operationalAccountNotice,type ActivationSubject,type ActivationRequest,type ActivationResult} from "./staff-activation-model";
type Props={subject:ActivationSubject;activate?:(request:ActivationRequest)=>Promise<ActivationResult>;readback?:(request:ActivationRequest)=>Promise<ActivationResult>;onVerified:(subject:ActivationSubject)=>void};
type Phase="idle"|"confirm"|"pending"|"unknown"|"stale"|"denied";
export function StaffActivationAction({subject,activate,readback,onVerified}:Props){
  const [phase,setPhase]=useState<Phase>("idle");
  const [review,setReview]=useState<ActivationRequest|null>(null);
  const locked=useRef(false),section=useRef<HTMLElement>(null),label=useId();
  const current=activationRequest(subject);
  const operationalNotice=operationalAccountNotice(subject);
  if(subject.status==="Đang làm")return <p role="status">{operationalNotice}</p>;
  const eligible=!!current&&!!activate;
  async function run(check:boolean){
    if(locked.current||!review)return;
    if(!check&&!sameActivationRequest(review,current)){setPhase("stale");return;}
    const action=check?readback:activate;
    if(!action)return;
    locked.current=true;setPhase("pending");
    try{
      const result=await action(review);
      if(result.kind==="activated"){
        if(!verifiedActivation(review,result.subject)){setPhase("unknown");return;}
        onVerified(result.subject);setPhase("idle");
      }else setPhase(result.kind);
    }catch{setPhase("unknown");}finally{locked.current=false;}
  }
  const cancel=()=>{setPhase("idle");setReview(null);requestAnimationFrame(()=>section.current?.querySelector<HTMLButtonElement>("[data-activation-launch]")?.focus());};
  return <TosCard><section ref={section} aria-labelledby={label}>
    <h3 id={label}>Kích hoạt Staff</h3>
    <p>Cơ sở: {subject.affiliation?.active?subject.affiliation.label:"Chưa xác minh"}</p><p role="status">{operationalNotice}</p>
    {phase==="idle"&&<><p>Chỉ kích hoạt hồ sơ nhân sự. Không tạo tài khoản, vai trò, quyền truy cập hoặc trạng thái hiện diện.</p><button className="primary-btn" data-activation-launch="true" type="button" disabled={!eligible} onClick={()=>{setReview(current);setPhase("confirm");requestAnimationFrame(()=>section.current?.querySelector<HTMLButtonElement>("[data-activation-cancel]")?.focus());}}>Kích hoạt Staff</button>{!eligible&&<p role="status">Chưa đủ điều kiện kích hoạt.</p>}</>}
    {phase==="confirm"&&<div role="group" aria-label="Xác nhận kích hoạt Staff" onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();cancel();}}}><p>Kích hoạt {subject.name} tại {subject.affiliation?.label}?</p><p>Trạng thái hồ sơ sẽ chuyển sang Đang làm. Không tạo tài khoản, vai trò hoặc quyền; không đồng nghĩa được phép vận hành.</p><button type="button" className="secondary-btn" data-activation-cancel="true" onClick={cancel}>Hủy</button>{" "}<button type="button" className="primary-btn" disabled={!sameActivationRequest(review,current)} onClick={()=>void run(false)}>Xác nhận kích hoạt</button></div>}
    {phase==="pending"&&<p role="status">Đang xác minh kích hoạt…</p>}
    {phase==="unknown"&&<><p role="alert">Chưa xác minh được kết quả. Không gửi lại yêu cầu kích hoạt.</p><button type="button" className="secondary-btn" disabled={!readback} onClick={()=>void run(true)}>Kiểm tra kết quả</button></>}
    {phase==="stale"&&<p role="alert">Hồ sơ hoặc cơ sở đã thay đổi. Hãy tải lại thông tin trước khi tiếp tục.</p>}
    {phase==="denied"&&<p role="alert">Không thể kích hoạt hồ sơ này.</p>}
  </section></TosCard>;
}
