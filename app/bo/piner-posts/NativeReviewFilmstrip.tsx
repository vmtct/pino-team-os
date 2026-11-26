"use client";
/** PAP-2386: bounded, private READY thumbnails; no persistent URLs or image bytes. */
import {useEffect,useState} from "react";
import type {NativeDraftSession} from "./native-draft-session";
type Controller=ReturnType<NativeDraftSession["mediaController"]>;
export function NativeReviewFilmstrip({controller,version,ids,selected,onSelect,busy}:{controller:Controller;version:number;ids:readonly string[];selected?:string;onSelect:(id:string)=>void;busy:boolean}){
 const signature=ids.join(","),[result,setResult]=useState<{signature:string;version:number;urls:Record<string,string>}|null>(null);
 useEffect(()=>{
  const ctl=new AbortController(),urls:Record<string,string>={};let alive=true;
  void Promise.resolve().then(async()=>{
   const list=signature?signature.split(","):[];
   if(list.length>5||new Set(list).size!==list.length)throw Error("Invalid image order");
   for(const id of list){
    const blob=await controller.readImage(id,version,ctl.signal);
    ctl.signal.throwIfAborted();urls[id]=URL.createObjectURL(blob);
   }
   if(alive)setResult({signature,version,urls:{...urls}});
  }).catch(()=>{for(const u of Object.values(urls))URL.revokeObjectURL(u);if(alive)setResult({signature,version,urls:{}});});
  return()=>{alive=false;ctl.abort();for(const u of Object.values(urls))URL.revokeObjectURL(u);};
 },[controller,signature,version]);
 const urls=result?.signature===signature&&result.version===version?result.urls:{};
 const current=selected&&ids.includes(selected)?selected:ids[0];
 return <><div className="pap2337-bo-hero">{current&&urls[current]?<picture><img src={urls[current]} alt="Ảnh xem trước bài đăng" width={640} height={480}/></picture>:<p role="status">Chưa xác minh được ảnh xem trước.</p>}{current?<span className="pap2337-bo-imageCounter">{ids.indexOf(current)+1}/{ids.length}</span>:null}{current===ids[0]?<span className="pap2337-bo-coverLabel">Ảnh bìa</span>:null}</div><div className="pap2337-bo-filmstrip" role="list" aria-label="Ảnh theo thứ tự gửi duyệt">{ids.map((id,index)=><div className="pap2337-bo-filmItem" role="listitem" key={id}><button type="button" className="pap2337-bo-filmThumb" aria-label={"Xem ảnh "+(index+1)} aria-pressed={current===id} disabled={busy} onClick={()=>onSelect(id)}>{urls[id]?<picture><img src={urls[id]} alt={"Ảnh "+(index+1)} width={64} height={64}/></picture>:index+1}</button></div>)}</div></>;
}
