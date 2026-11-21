"use client";
/** PAP-2242: CREATE shares the Participation View drawer property renderer. */
import {useState} from "react";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {recordProjection} from "@/app/components/workspace-renderer/projection";
import type {AuthorizationContext,ModuleSchema} from "@/lib/workspace-schema";
import {boParticipationSchema} from "./ParticipationSchema";
import {ParticipationPersonPicker,type ParticipationPersonOption} from "./ParticipationPersonPicker";

export type ParticipationCreateDraft = {workshopId:string;centerId:string;personId:string};
export function WorkshopParticipationCreate({workshopId,centerId,workshopName,centerName,people,context}:{
  workshopId:string;centerId:string;workshopName:string;centerName:string;
  people:readonly ParticipationPersonOption[];context:AuthorizationContext;
}){
  const [personId,setPersonId]=useState("");
  const record={id:"m1-create-draft",person:"",workshop:workshopName,center:centerName,status:"",group:null,usageCount:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
  const projection=recordProjection(boParticipationSchema as unknown as ModuleSchema,context,record);
  if(!projection)return null;
  return <div aria-label="Thêm người tham gia" data-workshop-id={workshopId} data-center-id={centerId}>
    <PropertySections variant="drawer" fields={projection.fields} record={projection.record}
      sections={[{id:"participation",label:"Thông tin tham gia",fields:["person","workshop","center"]}]}
      createFields={{person:{id:"participation-person-select",value:personId,onChange:setPersonId,required:true,
        control:<ParticipationPersonPicker people={people} selectedId={personId} onSelect={setPersonId}/>}}}/>
  </div>;
}
