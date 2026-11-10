"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {missionDefinition,missionFields,missionProvider} from "@/app/ho/learning/missions/schema";
type F=typeof missionFields;
type Loaded={adapter:AuthenticatedSurfaceAdapter<F>;row:Awaited<ReturnType<AuthenticatedSurfaceAdapter<F>["detail"]>>};
/** Owns only a nested instance of the existing HO Mission TDD Quick View; no cloned Drawer. */
export function HoLinkedMissionDrawer({missionId,onClose}:{missionId:string;onClose:()=>void}){
 const router=useRouter();
 const [loaded,setLoaded]=useState<Loaded|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  let holder:AuthenticatedSurfaceAdapter<F>|null=null;
  void createHoTddAdapter({registry:new TddRegistry(),definition:missionDefinition,provider:missionProvider},controller.signal)
   .then(async adapter=>{
    holder=adapter;
    const detail=await adapter.detail(missionId,controller.signal);
    if(!controller.signal.aborted)setLoaded({adapter,row:detail});
   }).catch(()=>{
    if(!controller.signal.aborted)setError("Không thể xác minh Mission từ Core.");
   });
  return ()=>{controller.abort();holder?.dispose();};
 },[missionId]);
 if(error)return <section role="alert">{error} <button type="button" onClick={onClose}>Đóng</button></section>;
 if(!loaded)return <p role="status">Đang tải Mission…</p>;
 if(!loaded.row)return <p role="alert">Mission không còn khả dụng.</p>;
 const {adapter,row}=loaded;
 return <TddRenderer view={{kind:"drawer",props:{
  registry:adapter.registry,schema:adapter.schema,context:adapter.context,
  record:row.row,status:"ready",onClose,
  onDetail:()=>{router.push("/ho/learning/missions?record="+encodeURIComponent(missionId));},
 }}}/>;
}
