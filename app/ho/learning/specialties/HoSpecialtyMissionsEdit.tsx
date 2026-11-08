"use client";
import {useEffect,useRef,useState} from "react";
import {readSpecialtyV2Detail,type SpecialtyV2Detail} from "@/lib/ho-specialty-v2-reader";
import {loadSpecialtyS5MissionCatalog} from "@/lib/ho-specialty-s5-missions";
import {postSpecialtyGraphCommand,type SpecialtyGraphCommand} from "@/lib/ho-specialty-v2-graph-client";
import type {SpecialtyMissionOption} from "@/lib/specialty-mission-picker";
import {HoSpecialtyMissionsTab} from "./HoSpecialtyMissionsTab";
import {HoLinkedMissionDrawer} from "./HoLinkedMissionDrawer";
import {HoSpecialtyMissionsRead} from "./HoSpecialtyMissionsRead";
import type {VerifiedRelationReceipt} from "./HoSpecialtyMissionsTab";

export function HoSpecialtyMissionsEdit({specialtyId,canManage,onSaved}:{
 specialtyId:string;canManage:boolean;onSaved:()=>void;
}){
 const [data,setData]=useState<{detail:SpecialtyV2Detail;options:SpecialtyMissionOption[]}|null>(null);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [missionDrawer,setMissionDrawer]=useState<string|null>(null);
 const attempted=useRef<{signature:string;key:string}|null>(null);
 const mounted=useRef<AbortController|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  void readSpecialtyV2Detail(specialtyId,window.fetch.bind(window),controller.signal)
   .then(async detail=>{
    if(detail.status!=="DRAFT"||!canManage)return {detail,options:[]};
    const options=await loadSpecialtyS5MissionCatalog(detail,window.fetch.bind(window),controller.signal);
    return {detail,options};
   }).then(next=>{if(!controller.signal.aborted)setData(next);})
   .catch(()=>{if(!controller.signal.aborted)setError("Không thể xác minh danh mục Mission từ Core.");});
  return ()=>{controller.abort();mounted.current?.abort();};
 },[specialtyId,canManage,refresh]);
 async function mutate(type:"LINK_MISSION"|"UNLINK_MISSION",levelId:string,missionId:string):Promise<VerifiedRelationReceipt>{
  const current=data?.detail;
  if(!current||current.status!=="DRAFT"||!canManage)throw Error("Not allowed");
  const cmd:SpecialtyGraphCommand={type,expectedVersion:current.version,levelId,missionId};
  const signature=JSON.stringify(cmd);
  if(!attempted.current||attempted.current.signature!==signature)
   attempted.current={signature,key:"spec_s5_"+crypto.randomUUID().replaceAll("-","")};
  const ctrl=new AbortController();mounted.current=ctrl;
  try{
   const next=await postSpecialtyGraphCommand(specialtyId,cmd,window.fetch.bind(window),ctrl.signal,attempted.current.key);
   attempted.current=null;
   setData(previous=>previous?{...previous,detail:next}:previous);
   onSaved();
   setRefresh(n=>n+1);
   return {verified:true,version:next.version};
  }catch(error){setRefresh(n=>n+1);throw error;}
  finally{mounted.current=null;}
 }
 // Fallback S4 read is the only legal view for published or unauthorized specialties.
 if(!canManage||data?.detail.status!=="DRAFT"&&data?.detail.status!==undefined)
  return <HoSpecialtyMissionsRead specialtyId={specialtyId}/>;
 if(error)return <section role="alert"><p>{error}</p><button type="button" onClick={()=>{
   setError("");setData(null);setRefresh(n=>n+1);
 }}>Thử lại</button></section>;
 if(!data)return <p role="status">Đang xác minh Nhiệm vụ và quyền chỉnh sửa từ Core…</p>;
 return <>
  <HoSpecialtyMissionsTab
   key={specialtyId+":"+data.detail.version}
   pathProgramId={data.detail.pathProgramId}
   levels={data.detail.levels}
   missionCatalog={data.options}
   onLink={(levelId,missionId)=>mutate("LINK_MISSION",levelId,missionId)}
   onUnlink={(levelId,missionId)=>mutate("UNLINK_MISSION",levelId,missionId)}
   onOpenMission={setMissionDrawer}
  />
  {missionDrawer?<HoLinkedMissionDrawer key={missionDrawer} missionId={missionDrawer} onClose={()=>setMissionDrawer(null)}/>:null}
 </>;
}
