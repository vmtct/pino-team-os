"use client";
import {useEffect,useState} from "react";
import {openingReviewActorLabel} from "@/lib/opening-review-actor-label";
import styles from "./OpeningEvidencePresentation.module.css";
import boStyles from "../bo.module.css";
import {openingEvidenceApi,type OpeningEvidenceRow,type EvidenceDetail} from "@/lib/bo-opening-evidence-api";

function PhotoPreview({row,assetId}:{row:OpeningEvidenceRow;assetId:string}){
  const [url,setUrl]=useState(""),[error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();let objectUrl="";
    void openingEvidenceApi.photo(row,assetId,controller.signal).then(blob=>{
      if(controller.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
    }).catch(()=>{if(!controller.signal.aborted)setError("Không thể xác minh ảnh private.");});
    return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[row,assetId]);
  // Private object URL from a checked same-origin response, never a public bucket URL.
  // eslint-disable-next-line @next/next/no-img-element
  return url?<div className={styles.photoPreview}><img src={url} alt="Ảnh setup" className={boStyles.mediaPreviewFrame}/></div>:<p role="status">{error||"Đang tải ảnh…"}</p>;
}
export function EvidenceStatusPill({status}:{status:"PENDING"|"APPROVED"|"REJECTED"}){
  const labels={PENDING:"Chờ duyệt",APPROVED:"Đã duyệt",REJECTED:"Từ chối"};
  const color={PENDING:"tag-yellow",APPROVED:"tag-green",REJECTED:"tag-red"};
  return <span className={"datatag "+color[status]}>{labels[status]}</span>;
}

/** PAP-764/PAP-767: the same scoped private gallery in Quick Drawer and Full Detail. */
export function OpeningEvidenceGallery({data,formatTime}:{data:EvidenceDetail;formatTime:(value:string)=>string}){
  const {row,history}=data;
  const submissions=history.filter(e=>e.kind==="SUBMISSION"&&e.privateAssetId);
  return <section className={styles.gallery} aria-label="Ảnh setup">
    {submissions.length===0?<p role="status">Chưa có ảnh setup.</p>:null}
    {submissions.map((e,index)=>{
      const review=history.filter(r=>r.kind==="REVIEW"&&r.roundId===e.roundId&&r.version>e.version).sort((a,b)=>b.version-a.version)[0];
      return <article className={styles.round} key={e.eventId}>
        <header className={styles.roundHeader}><div><h3>Vòng {index+1}</h3><p className={styles.metadata}>{e.actorLegalFullName??"—"} · {formatTime(e.occurredAt)}</p></div><EvidenceStatusPill status={review?.verdict??"PENDING"}/></header>
        <div className={styles.photos}>{(e.privateAssetIds??[e.privateAssetId!]).map(assetId=><PhotoPreview key={JSON.stringify([row.centerId,row.subjectType,row.openingReceiptId,row.version,assetId])} row={row} assetId={assetId}/>)}</div>
        {e.note?<div className={styles.note}><strong>Ghi chú</strong><p>{e.note}</p></div>:null}
        {review?<div className={styles.decision}><p className={styles.metadata}>{openingReviewActorLabel(review.actorLegalFullName,review.reviewAccountRecorded)} · {formatTime(review.occurredAt)}</p>{review.reason?<div className={styles.note}><strong>Lý do</strong><p>{review.reason}</p></div>:null}</div>:null}
      </article>;
    })}
  </section>;
}

/** A changed Center, receipt or list version remounts this scoped reader. */
export function OpeningEvidenceDrawerGallery({row,formatTime}:{row:OpeningEvidenceRow;formatTime:(value:string)=>string}){
  return <DrawerGalleryScope key={JSON.stringify([row.centerId,row.subjectType,row.openingReceiptId,row.version])} row={row} formatTime={formatTime}/>;
}
function DrawerGalleryScope({row,formatTime}:{row:OpeningEvidenceRow;formatTime:(value:string)=>string}){
  const [data,setData]=useState<EvidenceDetail|null>(null),[error,setError]=useState("");
  const {centerId,subjectType,openingReceiptId,version}=row;
  useEffect(()=>{
    const controller=new AbortController();
    void openingEvidenceApi.detail(centerId,subjectType,openingReceiptId,controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      if(result.row.version<version){setError("Chi tiết chưa đồng bộ. Tải lại danh sách.");return;}
      setData(result);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải ảnh setup.");});
    return()=>controller.abort();
  },[centerId,subjectType,openingReceiptId,version]);
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p role="status">Đang tải ảnh setup…</p>;
  return <>
    {data.row.version!==version?<p role="status">Bản ghi đã thay đổi. Mở chi tiết để xem trạng thái mới nhất.</p>:null}
    <OpeningEvidenceGallery data={data} formatTime={formatTime}/>
  </>;
}
