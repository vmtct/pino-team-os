"use client";
import "@/app/bo/bo.module.css"; // Load business-form CSS inside canonical PINO DS DrawerFrame.
import {useCallback,useState} from "react";
import {DrawerFrame,TosButton,TosCard} from "@pino/design-system/react";
import {readScopedParentDirectory} from "@/app/bo/parents/provider";
import {walkinPassBoApi,type WalkinPath,type VerifiedParentContact} from "@/lib/open-studio-walkin-bo-api";

type ScopedParent = Awaited<ReturnType<typeof readScopedParentDirectory>>[number];
const PATHS:readonly WalkinPath[]=["AC","LPP","LPA","PH"];
type Step="select"|"verify";

/** PAP-1248: scoped Parent proof in the approved Open Studio Pass creation Drawer. */
export function CenterPassActions({centerId,onChanged}:{centerId:string;onChanged:()=>void}){
 const [open,setOpen]=useState(false);
 const [step,setStep]=useState<Step>("select");
 const [query,setQuery]=useState("");
 const [parents,setParents]=useState<ScopedParent[]>([]);
 const [parentId,setParentId]=useState("");
 const [path,setPath]=useState<WalkinPath|"">("");
 const [contactValue,setContactValue]=useState("");
 const [candidate,setCandidate]=useState<VerifiedParentContact|null>(null);
 const [verifiedParent,setVerifiedParent]=useState<VerifiedParentContact|null>(null);
 const [holderConfirmed,setHolderConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [searching,setSearching]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [uncertain,setUncertain]=useState(false);

 const reset=useCallback(()=>{
  setStep("select");setQuery("");setParents([]);setParentId("");setPath("");
  setContactValue("");setCandidate(null);setVerifiedParent(null);setHolderConfirmed(false);
  setError("");setNotice("");setUncertain(false);
 },[]);
 function launch(){reset();setOpen(true)}
 const close=useCallback(()=>{if(busy||searching||uncertain)return;reset();setOpen(false);document.getElementById("pass-issue-launch")?.focus()},[busy,searching,uncertain,reset])
 // Parent lookup/proof state is isolated by a key on CenterPassActions in its TDD parent.

 async function search(){
  if(!query.trim()||busy||searching||uncertain)return;
  setSearching(true);setNotice("");setError("");setParents([]);setParentId("");
  try{
   const rows=await readScopedParentDirectory(centerId,fetch,new AbortController().signal);
   const key=query.trim().toLocaleLowerCase("vi-VN");
   const matches=rows.filter(r=>(r.name??"").toLocaleLowerCase("vi-VN").includes(key)).slice(0,25);
   setParents(matches);
   if(!matches.length)setNotice("Chưa tìm thấy Parent trong danh sách được Core cho phép. Hoàn tất xác minh Parent–Center tại quầy trước khi cấp Pass.");
  }catch{setError("Không thể tra cứu Parent trong phạm vi được cấp quyền.");}
  finally{setSearching(false)}
 }
 async function lookupContact(){
  if(!contactValue.trim()||busy||searching||uncertain)return;
  setSearching(true);setCandidate(null);setHolderConfirmed(false);setError("");setNotice("");
  try{
   const identifierType=contactValue.includes("@")?"EMAIL":"PHONE";
   const receipt=await walkinPassBoApi.recognizeVerifiedContact(centerId,identifierType,contactValue.trim());
   if(!receipt.candidate){
    setError("Không thể xác minh liên hệ theo thông tin cung cấp. Kiểm tra lại tại quầy.");
    return;
   }
   setCandidate(receipt.candidate);
  }catch{setError("Không thể xác minh liên hệ trong phạm vi Center. Không cấp Pass khi chưa có kết quả.");}
  finally{setSearching(false)}
 }
 async function verify(){
  if(!candidate||!holderConfirmed||busy||uncertain)return;
  setBusy(true);setError("");setNotice("");
  try{
   const proof=await walkinPassBoApi.verifyParentCenter(candidate,centerId);
   if(proof.parent_user_id!==candidate.parentId||proof.verified_contact_id!==candidate.contactIdentifierId||
      proof.center_id!==centerId||proof.request_id!==candidate.lookupRequestId||proof.revoked_at!==null)
    throw Error("Core trả về bằng chứng không khớp; cần đối chiếu.");
   setVerifiedParent(candidate);setParentId(candidate.parentId);setParents([]);
   setStep("select");setNotice("Đã xác minh Parent–Center qua Core. Chọn Path để cấp Pass.");
  }catch{
   // An uncertain successful write must NOT be retried with a new requestId.
   setUncertain(true);
   setError("Chưa xác nhận được kết quả chứng thực. Tải lại và đối chiếu Core trước khi thử lại.");
  }finally{setBusy(false)}
 }
 async function assign(){
  if(busy||uncertain||!parentId||!PATHS.includes(path as WalkinPath)||!centerId)return;
  setBusy(true);setError("");setNotice("");
  try{
   const pass=await walkinPassBoApi.assign(parentId,centerId,path as WalkinPath);
   if(pass.status!=="ASSIGNED"||pass.center_id!==centerId||pass.parent_user_id!==parentId||pass.path_code!==path)
    throw Error("Core Pass receipt không khớp");
   reset();setOpen(false);onChanged();
   setNotice("Đã cấp Pass. Xem mã và lịch sử trong Table/Detail.");
  }catch{
   setUncertain(true);
   setError("Trạng thái cấp Pass chưa được xác nhận. Đối chiếu Core trước khi gửi lại.");
  }finally{setBusy(false)}
 }
 return <>
  <TosCard><section aria-label="Cấp Pass Trạm Nghệ Thuật">
   <TosButton type="button" variant="primary" disabled={!centerId} onClick={launch} id="pass-issue-launch">＋ Cấp Pass</TosButton>
   <p>Chọn Parent và Path tại Center. Không tạo Student hoặc bill tự động.</p>
   {!open&&notice?<p role="status">{notice}</p>:null}
  </section></TosCard>
  {open?<DrawerFrame title={step==="verify"?"Xác minh Parent tại quầy":"Cấp Pass cho phụ huynh"} path="Trạm Nghệ Thuật" open onClose={close}>
    <div className="os-verify-body">
     {step==="select"?<>
      <label className="os-verify-field" htmlFor="pass-parent-search">Tìm Parent đã liên kết Center
       <div className="os-verify-search">
        <input id="pass-parent-search" type="search" value={query} disabled={busy||uncertain}
         onChange={e=>setQuery(e.target.value)} placeholder="Tên Parent"/>
        <TosButton type="button" variant="secondary" disabled={!query.trim()||busy||searching||uncertain} onClick={()=>void search()}>{searching?"Đang tìm…":"Tìm"}</TosButton>
       </div>
      </label>
      <label className="os-verify-field" htmlFor="pass-parent-select">Parent *
       <select id="pass-parent-select" value={parentId} disabled={busy||uncertain} onChange={e=>setParentId(e.target.value)}>
        <option value="">Chọn phụ huynh…</option>
        {parents.map(p=><option key={p.id} value={p.id}>{p.name??"Parent"}</option>)}
        {verifiedParent&&!parents.some(p=>p.id===verifiedParent.parentId)?
         <option value={verifiedParent.parentId}>{verifiedParent.parentName??"Parent"} · đã xác minh tại quầy</option>:null}
       </select>
      </label>
      <TosButton type="button" variant="secondary" disabled={busy||uncertain}
       onClick={()=>{setStep("verify");setCandidate(null);setHolderConfirmed(false);setError("");setNotice("")}}>
       Không thấy Parent? Xác minh liên hệ tại quầy
      </TosButton>
      <label className="os-verify-field" htmlFor="pass-path">Path *
       <select id="pass-path" value={path} disabled={busy||uncertain} onChange={e=>setPath(e.target.value as WalkinPath|"")}>
        <option value="">Chọn Path…</option>{PATHS.map(p=><option key={p} value={p}>{p}</option>)}
       </select>
      </label>
      <p>Mỗi Parent tối đa một Pass chưa sử dụng. Mã cấp từ kho HO.</p>
      <div className="os-verify-actions">
       <TosButton type="button" variant="secondary" disabled={busy||uncertain} onClick={close}>Hủy</TosButton>
       <TosButton type="button" variant="primary" disabled={!parentId||!path||busy||uncertain} onClick={()=>void assign()}>{busy?"Đang cấp…":"Cấp Pass"}</TosButton>
      </div>
     </>:<>
      <h4>1. Nhận diện liên hệ đã xác minh</h4>
      <p>Parent cung cấp số điện thoại hoặc email tại quầy. Chỉ tra cứu chính xác trong Core, không duyệt danh bạ chung.</p>
      <label className="os-verify-field" htmlFor="pass-contact-exact">Số điện thoại hoặc email *
       <div className="os-verify-search">
        <input id="pass-contact-exact" type="text" autoComplete="off" value={contactValue} disabled={busy||searching||uncertain}
         onChange={e=>{setContactValue(e.target.value);setCandidate(null);setHolderConfirmed(false);setError("")}}
         placeholder="Liên hệ Parent cung cấp"/>
        <TosButton type="button" variant="secondary" disabled={!contactValue.trim()||busy||searching||uncertain}
         onClick={()=>void lookupContact()}>{searching?"Đang kiểm tra…":"Tìm chính xác"}</TosButton>
       </div>
      </label>
      {candidate?<section aria-label="Parent được nhận diện">
       <h4>Liên hệ được Core xác minh</h4>
       <strong>{candidate.parentName??"Parent"}</strong><p>{candidate.maskedContact}</p>
       <h4>2. Đối chiếu người đến quầy</h4>
       <label className="os-verify-confirm">
        <input type="checkbox" checked={holderConfirmed} disabled={busy||uncertain} onChange={e=>setHolderConfirmed(e.target.checked)}/>
        <span>Tôi đã đối chiếu trực tiếp người đến quầy với tên và liên hệ đã xác minh.</span>
       </label>
       <p>Core sẽ ghi người xác minh, Center, phương thức xác minh tại quầy và bằng chứng. Không tự tạo Student.</p>
       <TosButton type="button" variant="primary" disabled={!holderConfirmed||busy||uncertain}
        onClick={()=>void verify()}>{busy?"Đang xác minh…":"Tiếp tục với Parent"}</TosButton>
      </section>:null}
      <div className="os-verify-actions">
       <TosButton type="button" variant="secondary" disabled={busy||uncertain} onClick={()=>{setStep("select");setError("");setCandidate(null);setHolderConfirmed(false)}}>Quay lại cấp Pass</TosButton>
      </div>
     </>}
     {notice?<p role="status">{notice}</p>:null}
     {error?<p role="alert">{error}</p>:null}
     {uncertain?<TosButton type="button" variant="secondary" onClick={()=>location.reload()}>Tải lại để đối chiếu Core</TosButton>:null}
    </div>
  </DrawerFrame>:null}
 </>;
}
