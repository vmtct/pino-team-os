"use client";
/** PAP-2030 / PNR-WISH — standalone read-only preview, no latest-revision fallback. */
import {useEffect,useState} from "react";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {verifyWishItemPreview,type WishItemPreviewSource,type WishItemPreviewTarget} from "./wish-item-preview";
type Props={target:WishItemPreviewTarget;load:WishItemPreviewSource;onClose:()=>void;path?:string};
export function HoWishItemPreview({target,load,onClose,path="Wish Banners / Item"}:Props){
 const [state,setState]=useState<{url:string;name:string;revision:number}|null>(null),[error,setError]=useState("");
 const [epoch,setEpoch]=useState(0);
 useEffect(()=>{
  const ctl=new AbortController();let url:string|null=null;
  void load(target,ctl.signal).then(r=>verifyWishItemPreview(target,r.metadata,r.media)).then(r=>{
   if(ctl.signal.aborted)return;url=URL.createObjectURL(r.media);setState({url,name:r.name,revision:r.revision});
  }).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải media Item.");});
  return()=>{ctl.abort();if(url)URL.revokeObjectURL(url);};
 },[target,load,epoch]);
 return <DrawerFrame title="Item Preview" path={path} onClose={onClose} footer={<button type="button" className="secondary-btn" onClick={onClose}>Đóng</button>}>
 <div className="v24-prop-section"><p className="settings-hint">{target.itemId} · r{target.revision}</p>
 {error?<><p role="alert">{error}</p><button type="button" className="secondary-btn" onClick={()=>{setError("");setState(null);setEpoch(x=>x+1);}}>Tải lại</button></>:state?<><h4>{state.name}</h4><p>Published · r{state.revision}</p>{/* Verified immutable binary object URL, no Next image optimizer or public media path. */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={state.url} alt={state.name} style={{display:"block",maxWidth:"100%",maxHeight:"55vh",objectFit:"contain",margin:"auto"}} onError={()=>{setState(null);setError("Media Item không hiển thị được.");}}/></>:<p role="status">Đang tải đúng phiên bản Item…</p>}
 </div></DrawerFrame>;
}
