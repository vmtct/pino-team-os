"use client";
import {useState} from "react";
import {publicPostHref} from "./publicApproved";
import css from "./launcher.module.css";
// PAP-1800 · UX copy/share only for server-allowlisted fixture posts.
// Until real Core publishing+revocation, this MUST NOT claim a newly local-shared post is public.
export function PublicShareAction({id,title}:{id:string;title:string}){
 const [status,setStatus]=useState("");
 const open=()=>publicPostHref(id);
 const share=async()=>{
  const url=open();
  try{
   if(navigator.share){await navigator.share({title,url});setStatus("Đã mở menu chia sẻ");return;}
   if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);setStatus("Đã sao chép liên kết");return;}
   const input=document.createElement("textarea");
   input.value=url;input.style.position="fixed";input.style.opacity="0";
   document.body.append(input);input.select();
   const copied=document.execCommand("copy");input.remove();
   setStatus(copied?"Đã sao chép liên kết":"Mở liên kết công khai");
  }catch(e){if((e as Error)?.name!=="AbortError")setStatus("Không thể chia sẻ trên trình duyệt này");}
 };
 return <span className={css.publicShareGroup} data-public-share={id}>
  <button type="button" onClick={share} aria-label={"Chia sẻ liên kết công khai "+title}>↗ <span>Gửi link</span></button>
  {status&&<small role="status">{status}</small>}
 </span>;
}
