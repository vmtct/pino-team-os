"use client";
import {useEffect,useState} from "react";
import {boApi} from "@/lib/bo-api";
import {allocateWishBannerId,parsePublishedWishChoices,loadPublishedWishPreview,loadPublishedWishRecord} from "./wish-published-item-client";
import type {PublishedWishItem} from "../wish-banners/wish-banner-edit";
import type {WishItemPreviewSource} from "../wish-banners/wish-item-preview";
import {HoWishPoliciesCatalog,HoWishBannersCatalog} from "./HoWishCatalog";
import type {WishLifecycleCommand,savePolicyDraft,saveBannerDraft} from "@/lib/pls-wish-ho-contract";
type Command=WishLifecycleCommand|ReturnType<typeof savePolicyDraft>|ReturnType<typeof saveBannerDraft>;
const root="/api/ho/pinoria/pls-wish/config/";
async function request(action:string,init?:RequestInit):Promise<unknown>{
 const response=await fetch(root+action,{cache:"no-store",credentials:"same-origin",...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
 const payload:unknown=await response.json();
 if(!response.ok)throw Error(response.status===409?"Cấu hình đã thay đổi. Tải lại để đối soát.":response.status===403?"Không có quyền cấu hình Wish.":"Không thể xử lý Wish ("+response.status+").");
 if(!payload||typeof payload!=="object"||!("data" in payload))throw Error("Không xác minh được dữ liệu Wish.");
 return payload.data;
}
const policies=(signal:AbortSignal)=>request("policies",{signal});
const banners=(signal:AbortSignal)=>request("banners",{signal});
async function command(cmd:Command):Promise<{receipt:unknown;readback:unknown}>{
 const raw=await request(cmd.action,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(cmd.body)});
 if(!raw||typeof raw!=="object"||!("receipt" in raw)||!("readback" in raw))throw Error("Không xác minh được kết quả Wish. Tải lại để đối soát.");
 return {receipt:raw.receipt,readback:raw.readback};
}
const linkedItem=(target:Parameters<WishItemPreviewSource>[0],signal:AbortSignal)=>loadPublishedWishRecord(request,target,signal);
const preview:WishItemPreviewSource=(target,signal)=>loadPublishedWishPreview(request,target,signal);
export function HoWishRuntime({kind,canManage,canViewItems=false}:{kind:"policy"|"banner";canManage:boolean;canViewItems?:boolean}){
 const [items,setItems]=useState<PublishedWishItem[]|undefined>(),[itemStatus,setItemStatus]=useState("loading"),[itemEpoch,setItemEpoch]=useState(0);
 useEffect(()=>{if(kind!=="banner"||!canViewItems)return;const ctl=new AbortController();void request("items",{signal:ctl.signal}).then(parsePublishedWishChoices).then(rows=>{if(!ctl.signal.aborted){setItems(rows);setItemStatus("ready");}}).catch(()=>{if(!ctl.signal.aborted){setItems(undefined);setItemStatus("error");}});return()=>ctl.abort();},[kind,canViewItems,itemEpoch]);
 const [labels,setLabels]=useState<Record<string,string>>({}),[status,setStatus]=useState("loading"),[epoch,setEpoch]=useState(0);
 useEffect(()=>{const ctl=new AbortController();const fetcher:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.any([ctl.signal,AbortSignal.timeout(15000),...(init?.signal?[init.signal]:[])])});
 void boApi.centers(fetcher).then(rows=>{
  if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.id!=="string"||typeof r.displayName!=="string"||!r.displayName.trim()))throw Error("Danh mục Center không hợp lệ.");
  if(!ctl.signal.aborted){setLabels(Object.fromEntries(rows.filter(r=>r.status==="active").map(r=>[r.id,r.displayName])));setStatus("ready");}
 }).catch(()=>{if(!ctl.signal.aborted){setLabels({});setStatus("error");}});return()=>ctl.abort();},[epoch]);
 return <>
 {status==="error"&&<p role="alert">Không tải được Center. <button type="button" className="secondary-btn" onClick={()=>{setStatus("loading");setEpoch(x=>x+1);}}>Thử lại</button></p>}
 {kind==="policy"?<HoWishPoliciesCatalog load={policies} centerLabels={labels} saveDraft={canManage&&status==="ready"?command:undefined} lifecycle={canManage?command:undefined}/>:<>
 {!canViewItems&&<p role="status">Chưa có quyền xem Item Published.</p>}
 {canViewItems&&itemStatus==="loading"&&<p role="status">Đang tải Item Published…</p>}
 {canViewItems&&itemStatus==="error"&&<p role="alert">Không tải được Item Published. <button type="button" className="secondary-btn" onClick={()=>{setItems(undefined);setItemStatus("loading");setItemEpoch(x=>x+1);}}>Thử lại</button></p>}
 <HoWishBannersCatalog load={banners} centerLabels={labels} items={canViewItems&&itemStatus==="ready"?items:undefined} allocateBannerId={canManage&&canViewItems?allocateWishBannerId:undefined} saveDraft={canManage&&canViewItems&&status==="ready"&&itemStatus==="ready"?command:undefined} lifecycle={canManage&&canViewItems&&itemStatus==="ready"?command:undefined} loadItemPreview={canViewItems?preview:undefined} loadLinkedItem={canViewItems?linkedItem:undefined}/>
 </>}
 </>;
}
