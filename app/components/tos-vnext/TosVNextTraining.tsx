"use client";
/** PAP-946: approved two-tab Thăng Tiến / Chứng Nhận, no mock state. */
import {useEffect,useState} from "react";
import {tosTrainingV5Api,TrainingV5ApiError,
 type TrainingV5CatalogItem,type TrainingV5Eligibility,type TrainingV5Registration} from "@/lib/tos-training-v5-api";
import {workforceTraining} from "@/lib/workforce-training-client";
import type {StaffQualification} from "@/lib/training-model";
import TrainingV4Presentation from "./TrainingV4Presentation";
type Tab="progress"|"certificates";
function errorText(e:unknown){
 if(e instanceof TrainingV5ApiError&&(e.status===404||e.status===501||e.status===503))
  return "Core Training V5 chưa được phát hành. Chức năng Đăng ký tạm khóa.";
 return e instanceof Error?e.message:"Không thể tải Training.";
}
export function TosVNextTraining(){
 const [tab,setTab]=useState<Tab>("progress");
 const [catalog,setCatalog]=useState<TrainingV5CatalogItem[]>([]);
 const [offset,setOffset]=useState(0);
 const [total,setTotal]=useState(0);
 const [selected,setSelected]=useState<TrainingV5CatalogItem|null>(null);
 const [eligibility,setEligibility]=useState<TrainingV5Eligibility|null>(null);
 const [eligibilityError,setEligibilityError]=useState("");
 const [eligibilityBusy,setEligibilityBusy]=useState(false);
 const [search,setSearch]=useState("");
 const [path,setPath]=useState("");
 const [statusFilter,setStatusFilter]=useState("Tất cả");
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
  setError("");setCatalog([]);setRegistrations([]);setSelected(null);setTotal(0);
  const timer=setTimeout(()=>{void Promise.all([tosTrainingV5Api.catalog({query:search.trim(),path:path.trim(),popularOnly:!search.trim(),limit:30,offset}),tosTrainingV5Api.registrations()])
   .then(([page,rows])=>{if(active){setCatalog(page.items);setTotal(page.total);setRegistrations(rows);setError("");}})
   .catch(e=>{if(active){setCatalog([]);setRegistrations([]);setError(errorText(e));}})
   .finally(()=>{if(active)setBusy(false)});},250);
  return()=>{active=false;clearTimeout(timer)};
 },[version,search,path,offset]);
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
 useEffect(()=>{
  if(!selected){setEligibility(null);setEligibilityError("");setEligibilityBusy(false);return;}
  let active=true;setEligibility(null);setEligibilityError("");setEligibilityBusy(true);
  void tosTrainingV5Api.eligibility(selected.moduleId).then(result=>{if(active)setEligibility(result)}).catch(err=>{if(active)setEligibilityError(errorText(err))}).finally(()=>{if(active)setEligibilityBusy(false)});
  return()=>{active=false};
 },[selected]);

 return <TrainingV4Presentation tab={tab} onTab={setTab}
  search={search} onSearch={value=>{setOffset(0);setSearch(value)}} path={path} onPath={value=>{setOffset(0);setPath(value)}}
  filter={statusFilter} onFilter={setStatusFilter} catalog={catalog} registrations={registrations} qualifications={qualifications}
  selected={selected} onSelect={setSelected} busy={busy} error={error} certBusy={certBusy} certError={certError}
  eligibility={eligibility} eligibilityBusy={eligibilityBusy} eligibilityError={eligibilityError} total={total} offset={offset} onOffset={setOffset}
  onRetry={()=>setVersion(value=>value+1)} onCertRetry={()=>setCertVersion(value=>value+1)}/>;
}
