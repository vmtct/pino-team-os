"use client";
// PAP-2337 / PNR-APP-HUB — native HO table, isolated synthetic presentation only.
import {useState} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import type {PostPreview} from "@/app/bo/content/posts/post-preview-contract";
import {baseQuery,registry,schema,context,projectEditorialRow} from "./editorial-table-model";

export function HoEditorialTable({posts,onOpen}:{posts:readonly PostPreview[];onOpen:(post:PostPreview)=>void}){
 const [query,setQuery]=useState(baseQuery);
 const rows=posts.map(projectEditorialRow);
 return <TddRenderer view={{kind:"table",headerActions:<small>Dữ liệu mẫu</small>,props:{
 registry,schema,context,rows,query,onQueryChange:setQuery,status:"ready",total:rows.length,
 onOpen:row=>{const post=posts.find(p=>p.id===row.id);if(post)onOpen(post);},
 renderReadOnlyCell:(record,field)=>{
 if(field.key!=="cover"||typeof record.cover!=="number"||record.cover<1)return undefined;
 const src=posts.find(p=>p.id===record.id&&p.fixture===true)?.media[0]?.src;
 return src&&/^data:image\/(?:jpeg|png|webp);base64,/.test(src)?<img className={"pap2337-ho-table-cover"} src={src} alt="Ảnh bìa" width={44} height={32}/>:undefined;
 }}}}/>;
}
