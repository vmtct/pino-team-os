"use client";
/** PAP-945: Core supplies identity/scope; the approved renderer receives no demo datastore. */
import {useEffect,useState} from "react";
import {classroomReadErrorMessage,loadClassroomV4} from "@/lib/tos-classroom-v4-reader";
import {type ClassroomV4ViewModel} from "@/lib/tos-classroom-v4-view-model";
import {AppButton} from "../tos-ds";
import ClassroomV4Presentation from "./ClassroomV4Presentation";
type ReadState={key:string;model:ClassroomV4ViewModel|null;status:number|null;busy:boolean};
export function TosVNextClassroom({centerId,localDate,profileLabel,onDetailChange,readOnly=false}:{centerId:string;localDate:string;profileLabel?:string|null;onDetailChange:(open:boolean)=>void;readOnly?:boolean}){
 const [refresh,setRefresh]=useState(0);
 const key=JSON.stringify([centerId,localDate,refresh]);
 const [read,setRead]=useState<ReadState>({key:"",model:null,status:null,busy:true});
 useEffect(()=>{
  let active=true;onDetailChange(false);setRead({key,model:null,status:null,busy:true});
  void loadClassroomV4(centerId,localDate,profileLabel||"Nhân sự").then(model=>{
   if(active)setRead({key,model,status:null,busy:false});
  }).catch(error=>{if(active)setRead({key,model:null,status:typeof error?.status==="number"?error.status:null,busy:false})});
  return()=>{active=false};
 },[centerId,localDate,refresh,key,profileLabel,onDetailChange]);
 if(read.key!==key||read.busy)return <p role="status">Đang tải lớp học…</p>;
 if(!read.model)return <section aria-label="Trạng thái lớp học"><p role="alert">{classroomReadErrorMessage(read.status)}</p><AppButton variant="secondary" onClick={()=>setRefresh(x=>x+1)}>Tải lại</AppButton></section>;
 if(read.model.classes.length===0)return <p>Không có lớp được phân công/được phép xem hôm nay.</p>;
 return <ClassroomV4Presentation key={key} model={read.model} onDetailChange={onDetailChange} readOnly={readOnly} onRosterChanged={async(classId,studentId)=>{
  const model=await loadClassroomV4(centerId,localDate,profileLabel||"Nhân sự");
  if(!model.data.participants[classId]?.includes(studentId))throw new Error("Roster inclusion not visible");
  setRead(previous=>previous.key===key?{...previous,model}:previous);
 }}/>;
}
