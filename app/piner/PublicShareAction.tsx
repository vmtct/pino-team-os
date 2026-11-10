"use client";
// PAP-1809 · A real, direct per-post anchor alongside native Share/Copy Link.
// Only rendered for server-allowlisted public fixtures, never private posts.
import {useState} from "react";
import {publicPostHref} from "./publicApproved";
import {PinoIcon} from "./PinoIcon";
import css from "./launcher.module.css";

export function PublicShareAction({id,title}:{id:string;title:string}){
 const [status,setStatus]=useState("");
 const localHref=publicPostHref(id);
 const share=async()=>{
  const url=new URL(localHref,window.location.origin).toString();
  try{
   if(navigator.share){await navigator.share({title,url});setStatus("Đã mở menu chia sẻ");return;}
   if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);setStatus("Đã sao chép liên kết");return;}
   const input=document.createElement("textarea");
   input.value=url;input.style.position="fixed";input.style.opacity="0";
   document.body.append(input);input.select();
   const copied=document.execCommand("copy");input.remove();
   setStatus(copied?"Đã sao chép liên kết":"Không thể sao chép");
  }catch(e){if((e as Error)?.name!=="AbortError")setStatus("Không thể chia sẻ trên trình duyệt này");}
 };
 return <span className={css.publicShareGroup} data-public-share={id}>
   <button type="button" onClick={share} aria-label={"Chia sẻ liên kết công khai "+title}>
    <PinoIcon name="share"/><span>Chia sẻ</span>
   </button>
   <a href={localHref} data-public-permalink={id} aria-label={"Xem trực tiếp bài đăng "+title}>
    <PinoIcon name="link"/><span>Xem bài</span>
   </a>
   {status&&<small role="status">{status}</small>}
 </span>;
}
