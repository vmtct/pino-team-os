"use client";
import {useEffect,useState} from "react";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {openingEvidenceApi,newReviewRequestKey,type OpeningEvidenceRow,type EvidenceDetail,type SubjectType} from "@/lib/bo-opening-evidence-api";
import {evidenceProperties,evidenceTime,detailHref,statusLabels,subjectLabels} from "../../OpeningEvidenceStageGate";
import {OpeningEvidenceGallery} from "../../OpeningEvidenceGallery";

function Review({row,onSaved}:{row:OpeningEvidenceRow;onSaved:()=>void}){
  const [reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [request,setRequest]=useState<{signature:string;key:string}|null>(null);
  if(!row.canReview||row.status!=="PENDING")return null;
  async function decide(verdict:"APPROVED"|"REJECTED"){
    if(busy)return;
    const note=verdict==="APPROVED"?"":reason.trim();
    if(verdict==="REJECTED"&&note.length<8){setMessage("Lý do từ chối cần ít nhất 8 ký tự.");return;}
    const signature=verdict+"|"+note;
    const key=request?.signature===signature?request.key:newReviewRequestKey();
    setRequest({signature,key});setBusy(true);setMessage("");
    try{await openingEvidenceApi.review(row,verdict,note,key);onSaved();}
    catch(e){setMessage(e instanceof Error?e.message:"Chưa thể xác nhận quyết định.");}
    finally{setBusy(false);}
  }
  return <section aria-label="Duyệt bằng chứng">
    <label>Lý do từ chối<textarea maxLength={1000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
    <div><button type="button" disabled={busy} onClick={()=>void decide("APPROVED")}>Duyệt</button>
      <button type="button" disabled={busy||reason.trim().length<8} onClick={()=>void decide("REJECTED")}>Từ chối</button></div>
    {message?<p role="alert">{message}</p>:null}
  </section>;
}
export default function OpeningEvidenceDetail(props:{subjectType:SubjectType;receiptId:string;activeTab?:string}){
  const scope=useBoCenterSelection(),centerId=scope?.selected??"";
  const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
  if(!allowed)return <p role="alert">Chọn cơ sở được cấp quyền.</p>;
  return <DetailScope key={JSON.stringify([centerId,props.subjectType,props.receiptId])} centerId={centerId} {...props}/>;
}
function DetailScope({centerId,subjectType,receiptId,activeTab}:{centerId:string;subjectType:SubjectType;receiptId:string;activeTab?:string}){
  const [data,setData]=useState<EvidenceDetail|null>(null),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    void openingEvidenceApi.detail(centerId,subjectType,receiptId,controller.signal).then(r=>{
      if(!controller.signal.aborted){setData(r);setError("");}
    }).catch(e=>{if(!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:"Không thể tải bằng chứng.");}});
    return()=>controller.abort();
  },[centerId,subjectType,receiptId,refresh]);
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p role="status">Đang tải bằng chứng…</p>;
  const {row,history}=data;
  const reload=()=>{setData(null);setRefresh(v=>v+1);};
  return <BoFullDetail designVariant="business-v25" title={row.subjectLabel} description={subjectLabels[row.subjectType]}
    currentUrl={detailHref(row)} returnTo={"/bo/opening-evidence?centerId="+encodeURIComponent(centerId)}
    activeTab={activeTab} tabs={[
      {id:"overview",label:"Tổng quan",content:<BoProperties items={evidenceProperties(row)}/>},
      {id:"evidence",label:"Ảnh setup & vòng duyệt",content:<section>
        <OpeningEvidenceGallery data={data} formatTime={evidenceTime}/>
        <p>{statusLabels[row.status]}</p>
        <Review key={row.version} row={row} onSaved={reload}/>
      </section>},
      {id:"history",label:"Lịch sử",content:<section aria-label="Lịch sử bằng chứng">
        {history.map(e=><article key={e.eventId}><BoProperties compact items={[
          {key:"time",label:"Thời gian",value:evidenceTime(e.occurredAt)},
          {key:"actor",label:"Nhân viên",value:e.actorLegalFullName??"—"},
          {key:"action",label:"Sự kiện",value:e.kind==="SUBMISSION"?"Gửi ảnh":statusLabels[e.verdict!]},
          {key:"reason",label:e.kind==="SUBMISSION"?"Ghi chú":"Lý do",value:(e.kind==="SUBMISSION"?e.note:e.reason)||"—"},
        ]}/></article>)}
      </section>},
    ]}/>;
}
