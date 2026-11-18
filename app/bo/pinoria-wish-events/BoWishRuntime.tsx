"use client";
import {useContext,useEffect,useMemo,useState} from "react";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {BoWishEventCatalog} from "@/app/bo/pinoria-wish/BoWishEventCatalog";
import type {WishInvalidationHost} from "@/app/bo/pinoria-wish/BoWishEventDetail";
import {scopedWishInvalidationJournal} from "@/lib/pls-wish-bo-journal-scope";
import {indexedWishInvalidationJournal} from "@/lib/pls-wish-invalidation-journal";
import type {BoWishRewardSource} from "@/app/bo/pinoria-wish/BoWishRewardSurface";
import {loadBoWishReward} from "@/lib/bo-pls-wish-reward-client";
import {parseBoWishDetail} from "@/lib/pls-wish-bo-contract";
const root="/api/bo/pinoria/pls-wish/events";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
async function data(path:string,init?:RequestInit):Promise<unknown>{
 const r=await fetch(path,{cache:"no-store",credentials:"same-origin",...init,signal:AbortSignal.any([AbortSignal.timeout(15000),...(init?.signal?[init.signal]:[])])});
 const raw:unknown=await r.json();
 if(!r.ok)throw Error(r.status===403?"Không có quyền trong Center đang chọn.":r.status===409?"Dữ liệu đã thay đổi. Tải lại để đối soát.":"Không thể xử lý Wish ("+r.status+").");
 if(!raw||typeof raw!=="object"||!("data" in raw))throw Error("Không xác minh được dữ liệu Wish.");
 return raw.data;
}
const load=(s:{centerId:string;limit:number;before?:{createdAt:string;eventId:string}},signal:AbortSignal)=>data(root+"?"+new URLSearchParams({centerId:s.centerId,limit:String(s.limit),...(s.before?{beforeCreatedAt:s.before.createdAt,beforeEventId:s.before.eventId}:{})}),{signal});
const detail=(s:{centerId:string;eventId:string},signal:AbortSignal)=>data(root+"/"+s.eventId+"?"+new URLSearchParams({centerId:s.centerId}),{signal});
type Cap={actor:string;invalidate:boolean};
async function capability(centerId:string,signal:AbortSignal):Promise<Cap>{
 const raw=await data("/api/bo/context?"+new URLSearchParams({centerId}),{signal});
 if(!raw||typeof raw!=="object")throw Error("Không có quyền Wish.");
 const r=raw as Record<string,unknown>;
 if(r.surface!=="BO"||r.entitled!==true||typeof r.userId!=="string"||!uuid.test(r.userId)||!Array.isArray(r.permissionKeys)||!r.permissionKeys.includes("pinoria.wish_event.view"))throw Error("Không có quyền xem Wish trong Center này.");
 return {actor:r.userId,invalidate:r.permissionKeys.includes("pinoria.wish_event.invalidate")};
}
export function BoWishRuntime(){
 const s=useBoCenterSelection(),menu=useContext(TddHostMenu),center=s&&!s.loading&&!s.error&&s.centers.some(c=>c.id===s.selected)?s.selected:"";
 return center?<Scope key={center} centerId={center}/>:<section>{menu("wish-center-menu")}<p role={s?.error?"alert":"status"}>{s?.error??"Chọn Center được cấp quyền."}</p></section>;
}
function Scope({centerId}:{centerId:string}){
 const menu=useContext(TddHostMenu),[cap,setCap]=useState<Cap|null>(null),[error,setError]=useState(""),[epoch,setEpoch]=useState(0);
 useEffect(()=>{const ctl=new AbortController();void capability(centerId,ctl.signal).then(c=>{if(!ctl.signal.aborted)setCap(c);}).catch(e=>{if(!ctl.signal.aborted){setCap(null);setError(e instanceof Error?e.message:"Không thể xác thực Wish.");}});return()=>ctl.abort();},[centerId,epoch]);
 const host=useMemo<WishInvalidationHost|undefined>(()=>{if(!cap?.invalidate||typeof indexedDB==="undefined")return undefined;
  const actor=cap.actor;
  const verify=async()=>{const current=await capability(centerId,AbortSignal.timeout(15000));if(current.actor!==actor||!current.invalidate)throw Error("Phiên hoặc quyền đã thay đổi.");};
  return {journal:scopedWishInvalidationJournal(indexedWishInvalidationJournal(actor),centerId,verify),async execute(attempt){
   if(attempt.body.centerId!==centerId)throw Error("Center đã thay đổi.");
   await verify();
   const raw=await data(root+"/"+attempt.body.eventId+"/invalidate?"+new URLSearchParams({centerId}),{method:"POST",headers:{"content-type":"application/json","idempotency-key":attempt.key,"x-pino-expected-actor":actor},body:JSON.stringify({reason:attempt.body.reason})});
   if(!raw||typeof raw!=="object"||!("receipt" in raw)||!("readback" in raw))throw Error("Chưa đối soát được Invalidate.");
   if(parseBoWishDetail(raw.readback,centerId,attempt.body.eventId).reversedBy!==actor)throw Error("Actor Invalidate không khớp.");
   return {receipt:raw.receipt,readback:raw.readback};
  }};
 },[cap,centerId]);
 const reward=useMemo<BoWishRewardSource|undefined>(()=>cap?async(event,ordinal,target,signal)=>{const current=await capability(centerId,signal);if(current.actor!==cap.actor)throw Error("Phiên hoặc quyền đã thay đổi.");return loadBoWishReward((path,init)=>data(root+"/"+path,init),event,ordinal,target,centerId,cap.actor,signal);}:undefined,[cap,centerId]);
 if(!cap)return <section>{menu("wish-center-menu")}{error?<p role="alert">{error} <button type="button" className="secondary-btn" onClick={()=>{setError("");setEpoch(x=>x+1);}}>Thử lại</button></p>:<p role="status">Đang xác thực Wish…</p>}</section>;
 return <BoWishEventCatalog key={cap.actor+":"+centerId} centerId={centerId} load={load} loadDetail={detail} invalidate={host} loadRewardPreview={reward} mobileMenu={menu("wish-center-menu")}/>;
}
