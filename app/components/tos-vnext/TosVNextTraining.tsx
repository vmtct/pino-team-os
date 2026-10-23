"use client";
/** PAP-946: approved two-tab Thăng Tiến / Chứng Nhận, no mock state. */
import {useEffect,useState} from "react";
import {tosTrainingV5Api,TrainingV5ApiError,TRAINING_V5_WRITE_ADMITTED,
 type TrainingV5CatalogItem,type TrainingV5Registration} from "@/lib/tos-training-v5-api";
import {workforceTraining} from "@/lib/workforce-training-client";
import {safeTrainingGuideUrl} from "@/lib/tos-training-guide-url";
import type {StaffQualification} from "@/lib/training-model";
import {TosVNextBottomNav,TosVNextButton,TosVNextCard,TosVNextHeading,TosVNextStatus,TosVNextSheet} from "./TosVNextUI";
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
 const [selected,setSelected]=useState<TrainingV5CatalogItem|null>(null);
 const [search,setSearch]=useState("");
 const [path,setPath]=useState("");
 const [statusFilter,setStatusFilter]=useState<"all"|"registered"|"unregistered">("all");
 const [registrations,setRegistrations]=useState<TrainingV5Registration[]>([]);
 const [qualifications,setQualifications]=useState<StaffQualification[]>([]);
 const [error,setError]=useState("");
 const [certError,setCertError]=useState("");
 const [busy,setBusy]=useState(true);
 const [certBusy,setCertBusy]=useState(true);
 const [version,setVersion]=useState(0);
 const [certVersion,setCertVersion]=useState(0);
 useEffect(()=>{
  let active=true;
  setBusy(true);
  setError("");setCatalog([]);setRegistrations([]);setSelected(null);
  const timer=setTimeout(()=>{void Promise.all([tosTrainingV5Api.catalog({query:search.trim(),path:path.trim()}),tosTrainingV5Api.registrations()])
   .then(([page,rows])=>{if(active){setCatalog(page.items);setRegistrations(rows);setError("");}})
   .catch(e=>{if(active){setCatalog([]);setRegistrations([]);setError(errorText(e));}})
   .finally(()=>{if(active)setBusy(false)});},250);
  return()=>{active=false;clearTimeout(timer)};
 },[version,search,path]);
 useEffect(()=>{
  let active=true;
  setCertBusy(true);
  setCertError("");setQualifications([]);
  void workforceTraining.self()
   .then(x=>{if(active){setQualifications(x.qualifications);setCertError("");}})
   .catch(e=>{if(active){setQualifications([]);setCertError(e instanceof Error?e.message:"Không thể tải chứng nhận.");}})
   .finally(()=>{if(active)setCertBusy(false)});
  return()=>{active=false};
 },[certVersion]);
 return <>
  {tab==="progress"?<>
   <TosVNextHeading title="Thăng Tiến" meta="Core Training V5"/>
   <TosVNextCard>
    <p className={styles.body}>Khám phá chương trình và tiến độ của bạn.</p>
    {!TRAINING_V5_WRITE_ADMITTED&&<p className={styles.secondary} role="status">Đăng ký chưa mở: Core PAP-848/849 chưa được xác nhận phát hành.</p>}
    <label className={styles.secondary} htmlFor="tos-vnext-training-search">Tìm theo mã hoặc tên</label>
    <input id="tos-vnext-training-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mã hoặc tên Training" />
    <label className={styles.secondary} htmlFor="tos-vnext-training-path">Lọc Path</label>
    <input id="tos-vnext-training-path" type="search" value={path} onChange={e=>setPath(e.target.value)} placeholder="Mã Path" />
    <label className={styles.secondary} htmlFor="tos-vnext-training-status">Trạng thái đăng ký</label>
    <select id="tos-vnext-training-status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}>
     <option value="all">Tất cả</option><option value="registered">Đã đăng ký</option><option value="unregistered">Chưa đăng ký</option>
    </select>
    {busy&&<p className={styles.secondary} role="status">Đang tải danh mục…</p>}
    {error&&<p role="alert" className={styles.trainingError}>{error}</p>}
    {error&&<TosVNextButton variant="secondary" onClick={()=>{setBusy(true);setVersion(x=>x+1);}}>Thử tải lại</TosVNextButton>}
   </TosVNextCard>
   {!busy&&!error&&catalog.length===0&&<TosVNextCard><p className={styles.secondary}>Chưa có Training đang mở trong Core.</p></TosVNextCard>}
   {!busy&&!error&&catalog.length>0&&statusFilter!=="all"&&!catalog.some(item=>{const registered=registrations.some(r=>r.moduleId===item.moduleId&&r.status!=="CANCELLED");return statusFilter==="registered"?registered:!registered})&&<TosVNextCard><p className={styles.secondary}>Không có Training phù hợp bộ lọc trạng thái.</p></TosVNextCard>}
   {!busy&&!error&&catalog.filter(item=>{const registered=registrations.some(r=>r.moduleId===item.moduleId&&r.status!=="CANCELLED");return statusFilter==="all"||(statusFilter==="registered"?registered:!registered)}).map(item=>{
    const record=registrations.find(r=>r.moduleId===item.moduleId&&r.status!=="CANCELLED");
    return <TosVNextCard key={item.moduleId}>
     <TosVNextHeading title={item.title} meta={item.code}/>
     <TosVNextButton variant="secondary" onClick={()=>setSelected(item)}>Chi tiết</TosVNextButton>
     <p className={styles.body}>{item.summary||item.description||"Chưa có mô tả."}</p>
     <p className={styles.secondary}>{item.path} · {item.track} · {item.minHours} giờ yêu cầu</p>
     {!!item.prerequisiteModuleIds.length&&<p className={styles.secondary}>Có {item.prerequisiteModuleIds.length} học phần tiên quyết (Core xác định điều kiện).</p>}
     {record?<TosVNextStatus>{record.status}</TosVNextStatus>:
      <TosVNextButton disabled title="Chờ tích hợp thao tác đăng ký Core V5">Đăng ký</TosVNextButton>}
     {safeTrainingGuideUrl(item.guideUrl)&&<p className={styles.secondary}>Tài liệu: <a href={safeTrainingGuideUrl(item.guideUrl)!} target="_blank" rel="noopener noreferrer">Mở hướng dẫn</a></p>}
    </TosVNextCard>;
   })}
  </>:<>
   <TosVNextHeading title="Chứng Nhận" meta="Core đã cấp"/>
   <TosVNextCard>
    <p className={styles.secondary}>Chứng nhận thực từ Training Core hiện hữu (F0). Không quy đổi thành chứng chỉ V5 khi Core chưa xác nhận.</p>
    {certBusy&&<p role="status" className={styles.secondary}>Đang tải chứng nhận…</p>}
    {certError&&<p role="alert" className={styles.trainingError}>{certError}</p>}
    {certError&&<TosVNextButton variant="secondary" onClick={()=>setCertVersion(x=>x+1)}>Thử tải lại chứng nhận</TosVNextButton>}
    {!certBusy&&!certError&&!qualifications.length&&<p className={styles.body}>Bạn chưa có chứng nhận từ Core.</p>}
    {!certBusy&&!certError&&qualifications.map(cert=><div className={styles.trainingCertRow} key={cert.id}>
      <strong>{cert.qualificationCode}</strong><TosVNextStatus>{cert.status}</TosVNextStatus>
      <small>Ngày cấp: {cert.grantedAt}{cert.expiresAt?" · Hết hạn: "+cert.expiresAt:""}</small>
    </div>)}
   </TosVNextCard>
  </>}
  {selected&&<TosVNextSheet title={selected.title} onClose={()=>setSelected(null)}>
   <p className={styles.secondary}>Mã: {selected.code} · Path: {selected.path} · {selected.track}</p>
   <p className={styles.body}>{selected.description||selected.summary||"Chưa có mô tả."}</p>
   <p className={styles.secondary}>Số giờ tối thiểu: {selected.minHours}</p>
   {selected.prerequisiteModuleIds.length>0&&<p className={styles.secondary}>Học phần tiên quyết: {selected.prerequisiteModuleIds.join(", ")}</p>}
   {safeTrainingGuideUrl(selected.guideUrl)&&<a href={safeTrainingGuideUrl(selected.guideUrl)!} target="_blank" rel="noopener noreferrer">Mở tài liệu hướng dẫn</a>}
   <p className={styles.secondary}>Đăng ký và xác nhận điều kiện do Core Training V5 quyết định.</p>
   <TosVNextButton disabled>Đăng ký · chờ Core V5</TosVNextButton>
  </TosVNextSheet>}
  <TosVNextBottomNav label="Điều hướng Thăng Tiến" active={tab}
   onChange={id=>setTab(id as Tab)}
   items={[{id:"progress",label:"Thăng Tiến",icon:"◈"},{id:"certificates",label:"Chứng Nhận",icon:"✧"}]}/>
 </>;
}
