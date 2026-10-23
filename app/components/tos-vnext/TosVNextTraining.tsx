"use client";
/** PAP-946: approved two-tab Thăng Tiến / Chứng Nhận, no mock state. */
import {useEffect,useState} from "react";
import {tosTrainingV5Api,TrainingV5ApiError,TRAINING_V5_WRITE_ADMITTED,
 type TrainingV5CatalogItem,type TrainingV5Registration} from "@/lib/tos-training-v5-api";
import {workforceTraining} from "@/lib/workforce-training-client";
import type {StaffQualification} from "@/lib/training-model";
import {TosVNextBottomNav,TosVNextButton,TosVNextCard,TosVNextHeading,TosVNextStatus} from "./TosVNextUI";
import styles from "./tos-vnext.module.css";
type Tab="progress"|"certificates";
function errorText(e:unknown){
 if(e instanceof TrainingV5ApiError&&(e.status===404||e.status===501||e.status===503))
  return "Core Training V5 chưa được phát hành. Chức năng Đăng ký tạm khóa.";
 return e instanceof Error?e.message:"Không thể tải Training.";
}
export function TosVNextTraining(){
 const [tab,setTab]=useState<Tab>("progress");
 const [catalog,setCatalog]=useState<TrainingV5CatalogItem[]>([]);
 const [registrations,setRegistrations]=useState<TrainingV5Registration[]>([]);
 const [qualifications,setQualifications]=useState<StaffQualification[]>([]);
 const [error,setError]=useState("");
 const [certError,setCertError]=useState("");
 const [busy,setBusy]=useState(true);
 const [certBusy,setCertBusy]=useState(true);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let active=true;
  void Promise.all([tosTrainingV5Api.catalog(),tosTrainingV5Api.registrations()])
   .then(([page,rows])=>{if(active){setCatalog(page.items);setRegistrations(rows);setError("");}})
   .catch(e=>{if(active){setCatalog([]);setRegistrations([]);setError(errorText(e));}})
   .finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[version]);
 useEffect(()=>{
  let active=true;
  void workforceTraining.self()
   .then(x=>{if(active){setQualifications(x.qualifications);setCertError("");}})
   .catch(e=>{if(active)setCertError(e instanceof Error?e.message:"Không thể tải chứng nhận.");})
   .finally(()=>{if(active)setCertBusy(false)});
  return()=>{active=false};
 },[]);
 return <>
  {tab==="progress"?<>
   <TosVNextHeading title="Thăng Tiến" meta="Core Training V5"/>
   <TosVNextCard>
    <p className={styles.body}>Khám phá chương trình và tiến độ của bạn.</p>
    {!TRAINING_V5_WRITE_ADMITTED&&<p className={styles.secondary} role="status">Đăng ký chưa mở: Core PAP-848/849 chưa được xác nhận phát hành.</p>}
    {busy&&<p className={styles.secondary} role="status">Đang tải danh mục…</p>}
    {error&&<p role="alert" className={styles.trainingError}>{error}</p>}
    {error&&<TosVNextButton variant="secondary" onClick={()=>{setBusy(true);setVersion(x=>x+1);}}>Thử tải lại</TosVNextButton>}
   </TosVNextCard>
   {!busy&&!error&&catalog.length===0&&<TosVNextCard><p className={styles.secondary}>Chưa có Training đang mở trong Core.</p></TosVNextCard>}
   {!busy&&!error&&catalog.map(item=>{
    const record=registrations.find(r=>r.moduleId===item.moduleId&&r.status!=="CANCELLED");
    return <TosVNextCard key={item.moduleId}>
     <TosVNextHeading title={item.title} meta={item.code}/>
     <p className={styles.body}>{item.summary||item.description||"Chưa có mô tả."}</p>
     <p className={styles.secondary}>{item.path} · {item.track} · {item.minHours} giờ yêu cầu</p>
     {!!item.prerequisiteModuleIds.length&&<p className={styles.secondary}>Có {item.prerequisiteModuleIds.length} học phần tiên quyết (Core xác định điều kiện).</p>}
     {record?<TosVNextStatus>{record.status}</TosVNextStatus>:
      <TosVNextButton disabled={!TRAINING_V5_WRITE_ADMITTED}>Đăng ký</TosVNextButton>}
     {item.guideUrl&&<p className={styles.secondary}>Tài liệu: <a href={item.guideUrl} target="_blank" rel="noopener noreferrer">Mở hướng dẫn</a></p>}
    </TosVNextCard>;
   })}
  </>:<>
   <TosVNextHeading title="Chứng Nhận" meta="Core đã cấp"/>
   <TosVNextCard>
    <p className={styles.secondary}>Chứng nhận thực từ Training Core hiện hữu (F0). Không quy đổi thành chứng chỉ V5 khi Core chưa xác nhận.</p>
    {certBusy&&<p role="status" className={styles.secondary}>Đang tải chứng nhận…</p>}
    {certError&&<p role="alert" className={styles.trainingError}>{certError}</p>}
    {!certBusy&&!certError&&!qualifications.length&&<p className={styles.body}>Bạn chưa có chứng nhận từ Core.</p>}
    {qualifications.map(cert=><div className={styles.trainingCertRow} key={cert.id}>
      <strong>{cert.qualificationCode}</strong><TosVNextStatus>{cert.status}</TosVNextStatus>
      <small>Ngày cấp: {cert.grantedAt}{cert.expiresAt?" · Hết hạn: "+cert.expiresAt:""}</small>
    </div>)}
   </TosVNextCard>
  </>}
  <TosVNextBottomNav label="Điều hướng Thăng Tiến" active={tab}
   onChange={id=>setTab(id as Tab)}
   items={[{id:"progress",label:"Thăng Tiến",icon:"◈"},{id:"certificates",label:"Chứng Nhận",icon:"✧"}]}/>
 </>;
}
