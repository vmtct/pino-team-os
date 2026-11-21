"use client";
/** PAP-2242 M1. Read-only create shell; no synthetic Person and no persistence. */
import {useState} from "react";
import {ParticipationPersonPicker,type ParticipationPersonOption} from "./ParticipationPersonPicker";

export type ParticipationCreateDraft = {workshopId:string;centerId:string;personId:string};
export function WorkshopParticipationCreate({
  workshopId,centerId,workshopName,centerName,people
}:{
  workshopId:string;centerId:string;workshopName:string;centerName:string;
  people:readonly ParticipationPersonOption[];
}){
  const [personId,setPersonId]=useState("");
  return <div aria-label="Thêm người tham gia" className="space-y-4" data-workshop-id={workshopId} data-center-id={centerId}>
    <div><span className="text-sm">Workshop</span><p>{workshopName}</p></div>
    <div><span className="text-sm">Chi nhánh</span><p>{centerName}</p></div>
    <ParticipationPersonPicker people={people} selectedId={personId} onSelect={setPersonId}/>
  </div>;
}
