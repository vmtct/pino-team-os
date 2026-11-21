"use client";
/** PAP-2242 M1. Native DSA Participation Table inside the approved BO Workshop business tab. */
import {useState} from "react";
import type {AuthorizationContext} from "@/lib/workspace-schema";
import {TddTable} from "@/app/components/workspace-renderer/Table";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {boParticipationBinding,type ParticipationRow} from "./ParticipationSchema";
import {WorkshopParticipationCreate} from "./WorkshopParticipationCreate";

export type ParticipationPreview = {
  id:string;
  personLabel:string;
  status:string;
  group?:"Hội họa"|"Piano"|null;
  usageCount?:number|null;
};

export function WorkshopParticipationTab({
  workshopId,centerId,workshopName,centerName,rows,context,canCreate,onOpen,unavailable=false
}:{
  workshopId:string;
  centerId:string;
  workshopName:string;
  centerName:string;
  rows:readonly ParticipationPreview[];
  context:AuthorizationContext;
  canCreate:boolean;
  onOpen?:(participationId:string)=>void;
  unavailable?:boolean;
}){
  const binding=boParticipationBinding;
  const [createOpen,setCreateOpen]=useState(false);
  const [query,setQuery]=useState(binding.query);
  const tableRows:readonly ParticipationRow[]=rows.map(row=>({
    id:row.id,person:row.personLabel,workshop:workshopName,center:centerName,status:row.status,
    group:row.group??null,usageCount:row.usageCount??null,
    createdAt:null,createdBy:null,updatedAt:null,updatedBy:null,
  }));
  return <section aria-label="Participation" className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">Người tham gia</h2>
        <p className="text-sm">Workshop: {workshopName}</p>
      </div>
      {canCreate?<button type="button" className="primary-btn" onClick={()=>setCreateOpen(true)}>Thêm người tham gia</button>:null}
    </div>
    {unavailable?<p role="status">Core read chưa được kết nối. Không có Participation giả hoặc thao tác ghi trong M1.</p>:null}
    <TddTable registry={binding.registry} schema={binding.schema} context={context} rows={tableRows} query={query} status="ready" onQueryChange={setQuery} onOpen={record=>onOpen?.(record.id)}/>
    {createOpen?<DrawerFrame title="Thêm người tham gia" path="Workshop MyTime" onClose={()=>setCreateOpen(false)} footer={<><button type="button" className="secondary-btn" onClick={()=>setCreateOpen(false)}>Hủy</button><button type="button" className="primary-btn" disabled aria-disabled="true">Thêm người tham gia</button></>}>
      <WorkshopParticipationCreate workshopId={workshopId} centerId={centerId} workshopName={workshopName} centerName={centerName} people={[]}/>
      <p role="status">M1 chỉ trình bày giao diện. Tạo thật sẽ được nối sau Founder Gate1.</p>
    </DrawerFrame>:null}
  </section>;
}
