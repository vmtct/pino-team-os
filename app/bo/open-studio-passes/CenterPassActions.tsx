"use client";
import {useState} from "react";
import {TosButton,TosCard} from "@pino/design-system/react";
import {boApi} from "@/lib/bo-api";
import type {BoParentSearchResult} from "@/lib/bo-model";
import {walkinPassBoApi,type WalkinPath} from "@/lib/open-studio-walkin-bo-api";
type Code="AC"|"LPP"|"LPA"|"PH";
const paths:readonly Code[]=["AC","LPP","LPA","PH"];
/** Bounded business command. TDD owns all Table/Drawer/Detail shells and navigation. */
export function CenterPassActions({centerId,onChanged}:{centerId:string;onChanged:()=>void}){
 const [parentQuery,setParentQuery]=useState("");
 const [parents,setParents]=useState<BoParentSearchResult[]>([]);
 const [parentId,setParentId]=useState("");
 const [path,setPath]=useState<WalkinPath|"">("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const [searching,setSearching]=useState(false);
 async function search(){
  if(!parentQuery.trim()||searching)return;
  setSearching(true);setError("");setParents([]);setParentId("");
  try{const all=await boApi.parents(parentQuery.trim(),50);
   setParents(all.filter(r=>r.parent.status==="ACTIVE"));
  }catch{setError("Không thể tra cứu Parent trong phạm vi được cấp quyền.");}
  finally{setSearching(false);}
 }
 async function assign(){
  if(busy||uncertain||!parentId||!paths.includes(path as Code)||!centerId)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await walkinPassBoApi.assign(parentId,centerId,path as WalkinPath);
   if(result.status!=="ASSIGNED"||result.center_id!==centerId||result.parent_user_id!==parentId||result.path_code!==path)
    throw Error("Không khớp Pass vừa cấp. Đối chiếu Core trước khi thử lại.");
   setNotice("Đã cấp Pass thành công. Dùng bảng TDD để kiểm tra thông tin và mã Pass.");
   setParentId("");setParents([]);setParentQuery("");setPath("");
   onChanged();
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:"Trạng thái cấp Pass chưa được xác minh.");}
  finally{setBusy(false);}
 }
 return <TosCard><section aria-label="Cấp Pass Trạm Nghệ Thuật">
  <h3>Cấp Pass cho Parent</h3>
  <p>Pass một lượt, gắn Parent và Path tại Center đang chọn. Không tạo bill hoặc gửi e-pass tự động.</p>
  <div className="property-row">
   <label htmlFor="pass-parent-search">Tìm Parent</label>
   <input id="pass-parent-search" type="search" value={parentQuery} disabled={busy||uncertain}
    onChange={e=>setParentQuery(e.target.value)} placeholder="Tên / số điện thoại / email"/>
   <TosButton type="button" variant="secondary" disabled={searching||!parentQuery.trim()||busy||uncertain} onClick={()=>void search()}>{searching?"Đang tìm…":"Tìm"}</TosButton>
  </div>
  <div className="property-row">
   <label htmlFor="pass-parent-select">Parent</label>
   <select id="pass-parent-select" value={parentId} disabled={busy||uncertain} onChange={e=>setParentId(e.target.value)}>
    <option value="">Chọn Parent</option>
    {parents.map(r=><option key={r.parent.id} value={r.parent.id}>{r.parent.displayName??"Parent"}</option>)}
   </select>
  </div>
  <div className="property-row">
   <label htmlFor="pass-path">Path</label>
   <select id="pass-path" value={path} disabled={busy||uncertain} onChange={e=>setPath(e.target.value as WalkinPath|"")}>
    <option value="">Chọn Path</option>{paths.map(p=><option key={p} value={p}>{p}</option>)}
   </select>
  </div>
  <TosButton type="button" variant="primary" disabled={busy||uncertain||!parentId||!paths.includes(path as Code)}
   onClick={()=>void assign()}>{busy?"Đang cấp…":"Xác nhận cấp Pass"}</TosButton>
  {notice?<p role="status">{notice}</p>:null}
  {error?<p role="alert">{error} Không gửi lại yêu cầu khi chưa đối chiếu dữ liệu thực.</p>:null}
  {uncertain?<TosButton type="button" variant="secondary" onClick={()=>location.reload()}>Tải lại kho Pass để đối chiếu</TosButton>:null}
 </section></TosCard>;
}
