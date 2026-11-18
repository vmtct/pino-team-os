"use client";
/** PAP-2135: contextual historical Pinoria Item, rendered by the original TDD schema.
 * The host supplies an authorized exact-revision record. No fallback to current Item. */
import {useEffect,useMemo,useState,type ReactNode} from "react";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {TddDrawer,TddDetail,RecordState} from "@/app/components/workspace-renderer/Record";
import {TddRegistry,type AuthorizationContext} from "@/lib/workspace-schema";
import {itemDefinition,extensionVerifier,projectItemRow} from "../wardrobe/schema";
import {validateItem,type ItemRecord} from "../wardrobe/item-client";
import type {WishItemPreviewTarget,WishItemPreviewSource} from "./wish-item-preview";
import {HoWishItemPreview} from "./HoWishItemPreview";
export type LinkedWishItemSource=(target:WishItemPreviewTarget,signal:AbortSignal)=>Promise<{record:unknown;context:AuthorizationContext}>;
export function HoWishLinkedItem({target,load,mode,onClose,onDetail,mobileMenu,loadMedia}:{target:WishItemPreviewTarget;load:LinkedWishItemSource;mode:"drawer"|"detail";onClose:()=>void;onDetail:()=>void;mobileMenu?:ReactNode;loadMedia?:WishItemPreviewSource}){
 const [loaded,setLoaded]=useState<{item:ItemRecord;context:AuthorizationContext}|null>(null),[status,setStatus]=useState<"loading"|"ready"|"error"|"denied">("loading"),[retry,setRetry]=useState(0),[media,setMedia]=useState(false);
 useEffect(()=>{const ctl=new AbortController();void load(target,ctl.signal).then(({record,context})=>{
  ctl.signal.throwIfAborted();
  if(context.surface!=="HO"||!context.authorize("pinoria.item.view")){setLoaded(null);setStatus("denied");return;}
  const item=validateItem(record);
  if(item.id!==target.itemId||item.revision!==target.revision||item.status!=="PUBLISHED"||item.type==="SET"||item.pendingDraft)throw Error("Item revision mismatch");
  setLoaded({item,context});setStatus("ready");
 }).catch(()=>{if(!ctl.signal.aborted){setLoaded(null);setStatus("error");}});return()=>ctl.abort();},[target,load,retry]);
 // Context is supplied by the host; while loading, there is no admission to record data.
 const admitted=loaded?.context;
 const context=useMemo<AuthorizationContext>(()=>({surface:"HO",authorize:permission=>permission==="pinoria.item.view"&&!!admitted&&admitted.surface==="HO"&&admitted.authorize(permission)}),[admitted]);
 const row=useMemo(()=>loaded?projectItemRow(loaded.item):null,[loaded]);
 const {registry,schema}=useMemo(()=>{const registry=new TddRegistry((approval,scope)=>extensionVerifier(approval,scope));
 const schema=registry.register({...itemDefinition,data:{id:"wish-linked-item",list:async()=>({rows:[],total:0}),detail:async(id,ctx,signal)=>{signal.throwIfAborted();return ctx===context&&context.authorize("pinoria.item.view")&&row&&id===row.id?row:null;}}});return {registry,schema};},[context,row]);
 const onRetry=()=>{setLoaded(null);setStatus("loading");setRetry(x=>x+1);};
 if(!row||!loaded||status!=="ready")return <DrawerFrame path="Pinoria · Items" title="Chi tiết" onClose={onClose} footer={<button type="button" id="full-detail" className="primary-btn" disabled>↗ Full Detail</button>}><RecordState status={status} onRetry={onRetry}/></DrawerFrame>;
 const common={registry,schema,context,record:row,status,onRetry};
 if(mode==="drawer")return <TddDrawer {...common} onClose={onClose} onDetail={onDetail}/>;

 return <><TddDetail {...common} subject={{type:"wardrobe",id:target.itemId}} onBack={onClose} mobileMenu={mobileMenu} overviewAfter={loadMedia?<button className="secondary-btn" type="button" onClick={()=>setMedia(true)}>Xem ảnh Item</button>:undefined}/>{media&&loadMedia&&<HoWishItemPreview target={target} load={loadMedia} onClose={()=>setMedia(false)} path="Pinoria · Items"/>}</>;
}
