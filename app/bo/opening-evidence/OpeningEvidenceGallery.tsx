"use client";
import {useEffect,useState} from "react";
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
  return url?<img src={url} alt="Ảnh setup" style={{maxWidth:"100%",maxHeight:320,objectFit:"contain"}}/>:<p role="status">{error||"Đang tải ảnh…"}</p>;
}
/** PAP-764/PAP-767: the same scoped private gallery in Quick Drawer and Full Detail. */
export function OpeningEvidenceGallery({data,formatTime}:{data:EvidenceDetail;formatTime:(value:string)=>string}){
  const {row,history}=data;
  return <section aria-label="Ảnh setup">
    {history.filter(e=>e.kind==="SUBMISSION"&&e.privateAssetId).map(e=><article key={e.eventId}>
      <h3>Vòng {e.version}</h3><p>{e.actorLegalFullName??"—"} · {formatTime(e.occurredAt)}</p>
      {e.note?<p>Ghi chú: {e.note}</p>:null}
      {(e.privateAssetIds??[e.privateAssetId!]).map(assetId=><PhotoPreview key={JSON.stringify([row.centerId,row.subjectType,row.openingReceiptId,row.version,assetId])} row={row} assetId={assetId}/>)}
    </article>)}
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
