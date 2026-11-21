"use client";
/** PAP-2242 · BO Workshop detail is the sole creation entry point. */
import {useState,type FormEvent} from "react";
import {ParticipationPersonPicker,type ParticipationPersonOption} from "./ParticipationPersonPicker";

export type ParticipationCreateDraft = {workshopId:string;centerId:string;personId:string};
export function WorkshopParticipationCreate({
 workshopId,centerId,workshopName,people,onCancel,onSubmit,busy=false
}:{
 workshopId:string;centerId:string;workshopName:string;
 people:readonly ParticipationPersonOption[];
 onCancel:()=>void;onSubmit:(draft:ParticipationCreateDraft)=>Promise<void>;
 busy?:boolean;
}){
 const [personId,setPersonId]=useState("");
 const [error,setError]=useState("");
 const [submitting,setSubmitting]=useState(false);
 const locked=busy||submitting;
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(locked)return;
  if(!personId||!people.some(p=>p.personId===personId)){setError("Vui lòng chọn Person hợp lệ.");return;}
  if(!workshopId||!centerId){setError("Thiếu Workshop hoặc Center được xác thực.");return;}
  setSubmitting(true);setError("");
  try{await onSubmit({workshopId,centerId,personId});}
  catch{setError("Không thể thêm người tham gia. Vui lòng thử lại.");}
  finally{setSubmitting(false);}
 };
 return <form aria-label="Thêm người tham gia" onSubmit={event=>void submit(event)} className="space-y-4">
  <h2 className="text-lg font-semibold">Thêm người tham gia</h2>
  <div><span className="text-sm">Workshop</span><p>{workshopName}</p></div>
  <ParticipationPersonPicker people={people} selectedId={personId} onSelect={setPersonId} disabled={locked}/>
  {error?<p role="alert">{error}</p>:null}
  <div className="flex justify-end gap-2">
   <button type="button" className="secondary-btn" disabled={locked} onClick={onCancel}>Hủy</button>
   <button type="submit" className="primary-btn" disabled={locked||!personId}>Thêm người tham gia</button>
  </div>
 </form>;
}
