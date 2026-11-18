"use client";
/** PAP-2096 — native DSA renderer, no parallel form or client authority. */
import {useRef,useState} from "react";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import type {BoRecord} from "@/lib/bo-registration";
import {blankWorldDraft,worldDrawerModule,worldCreateDrawerModule,worldCreateEditable,setWorldDraft,worldCreatePayload,assertWorldCreated,type CreateWorldPayload} from "./world-drawer-contract";
type Props={record:BoRecord|null;canCreate:boolean;onClose:()=>void;onDetail?:()=>void;createWorld:(payload:CreateWorldPayload)=>Promise<BoRecord>;onCreated:(record:BoRecord)=>void};
export function HoWorldDrawer({record,canCreate,onClose,onDetail,createWorld,onCreated}:Props){
 const [draft,setDraft]=useState(blankWorldDraft),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const inFlight=useRef(false),uncertain=useRef(false);
 const [outcomeUncertain,setOutcomeUncertain]=useState(false);
 async function submit(){
  if(record||!canCreate||inFlight.current||uncertain.current)return;
  let payload:CreateWorldPayload;
  try{payload=worldCreatePayload(draft)}catch(e){setError(e instanceof Error?e.message:"Dữ liệu không hợp lệ.");return}
  inFlight.current=true;setBusy(true);setError("");
  try{const row=await createWorld(payload);assertWorldCreated(row,payload);onCreated(row);}
  catch(e){uncertain.current=true;setOutcomeUncertain(true);setError((e instanceof Error?e.message:"Không thể xác minh tạo World.")+" Đóng và kiểm tra danh mục trước khi thử lại.");}
  finally{inFlight.current=false;setBusy(false);}
 }
 if(!record&&!canCreate)return <p role="alert">Bạn không có quyền tạo World.</p>;
 return <BoQuickView moduleKey="worlds" legacyStyles module={record?worldDrawerModule:worldCreateDrawerModule} record={record} onClose={()=>{if(!inFlight.current)onClose()}} onDetail={onDetail} create={record?undefined:{title:"Tạo World",path:"Pinoria / World",draft,editable:f=>canCreate&&!busy&&!outcomeUncertain&&worldCreateEditable(f),editorField:f=>({...f,readonly:false}),onChange:(key,value)=>{setDraft(d=>setWorldDraft(d,key,value));setError("")},onCreate:submit,busy:busy||outcomeUncertain,error}}/>;
}
