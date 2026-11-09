"use client";
/** PAP-1710 · Epic PAP-1705 / PNR-AVATAR-CRUD.
 * Product-facing Avatar; existing Core Self identifiers and authorized POST stay unchanged. */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BoActionButton } from "@pino/design-system/react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { toLegacyModule } from "@/lib/workspace-schema";
import type { BoRecord } from "@/lib/bo-registration";
import { selfDefinition, selfSchema } from "./schema";
import {
 candidateHasAvatar,isEligibleAvatarCandidate,matchingAvatarCandidates,
 type AvatarCandidate
} from "./avatar-picker";
import styles from "./CreateAvatarDrawer.module.css";

type DirectoryPage={items:AvatarCandidate[];nextCursor:string|null};

function errorFor(status:number):string{
 if(status===401)return "Phiên đăng nhập đã hết hạn.";
 if(status===403)return "Bạn không có quyền tạo Avatar tại cơ sở đang chọn.";
 if(status===404)return "Person không còn đủ điều kiện tại cơ sở này.";
 if(status===409)return "Person này đã có Avatar. Tải lại danh sách để kiểm tra.";
 return "Không thể xác nhận kết quả. Hãy kiểm tra lại danh sách trước khi thử lại.";
}

export function CreateSelfDrawer({centerId,onClose,onCreated}:{centerId:string;onClose:()=>void;onCreated:()=>void}){
 const [query,setQuery]=useState("");
 const [inputValue,setInputValue]=useState("");
 const [candidates,setCandidates]=useState<AvatarCandidate[]>([]);
 const [loading,setLoading]=useState(true);
 const [hasMore,setHasMore]=useState(false);
 const [loadError,setLoadError]=useState("");
 const [error,setError]=useState("");
 const [person,setPerson]=useState<AvatarCandidate|null>(null);
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(0);
 const [retry,setRetry]=useState(0);
 const [saving,setSaving]=useState(false);
 const [nickname,setNickname]=useState("");
 const [duplicateConflict,setDuplicateConflict]=useState(false);
 const listId=useId();
 const inputRef=useRef<HTMLInputElement>(null);
 const nicknameRef=useRef<HTMLInputElement>(null);
 const optionRefs=useRef<Array<HTMLButtonElement|null>>([]);
 // An authorization-scoped Core query, never guessed by client name/email matching.
 // Abort stale search, cap pagination, and disclose truncation instead of claiming an exhaustive list.
 useEffect(()=>{
  const ctl=new AbortController();
  const timer=setTimeout(()=>{
   setLoading(true);setLoadError("");setHasMore(false);setCandidates([]);
   void (async()=>{
    try{
     let cursor:string|null=null;let more=false;
     const entries:AvatarCandidate[]=[];const seen=new Set<string>();
     for(let page=0;page<10;page++){
      const params=new URLSearchParams({centerId,limit:"100",...(query.trim()?{q:query.trim()}:{}),...(cursor?{cursor}:{})});
      const response=await fetch("/api/bo/pinoria/avatars?"+params.toString(),{signal:ctl.signal,credentials:"same-origin",cache:"no-store"});
      if(!response.ok)throw Error(errorFor(response.status));
      const body:unknown=await response.json();
      if(!body||typeof body!=="object"||!("data" in body))throw Error("Danh sách Person không hợp lệ.");
      const data=(body as {data:DirectoryPage}).data;
      if(!data||!Array.isArray(data.items)||!(data.nextCursor===null||typeof data.nextCursor==="string"))
       throw Error("Danh sách Person không hợp lệ.");
      for(const raw of data.items){
       if(!isEligibleAvatarCandidate(raw)||seen.has(raw.personId))continue;
       seen.add(raw.personId);entries.push(raw);
      }
      cursor=data.nextCursor;
      if(!cursor)break;
      if(page===9)more=true;
     }
     if(!ctl.signal.aborted){setCandidates(entries);setHasMore(more);}
    }catch(e){
     if(!ctl.signal.aborted)setLoadError(e instanceof Error?e.message:"Không tải được Person.");
    }finally{if(!ctl.signal.aborted)setLoading(false);}
   })();
  },query.trim()?200:0);
  return ()=>{clearTimeout(timer);ctl.abort();};
 },[centerId,query,retry]);
 const matches=useMemo(()=>matchingAvatarCandidates(candidates,query),[candidates,query]);
 const visibleMatches=matches.slice(0,8);
 // PAP-1754: scrolling the bounded listbox must also expose the keyboard-active option.
 useEffect(()=>{if(open)optionRefs.current[active]?.scrollIntoView({block:"nearest"});},[active,open,query,candidates]);
 const duplicate=!!person&&(duplicateConflict||candidateHasAvatar(person));
 const canCreate=!!person&&!duplicate&&!saving&&!loading&&!loadError;
 function choose(option:AvatarCandidate){
  if(saving)return;
  setPerson(option);
  setInputValue(option.displayName+" · "+option.subjectTypes.join(" / "));
  setQuery("");setDuplicateConflict(false);setError("");setOpen(false);setActive(0);
  nicknameRef.current?.focus();
 }
 function changeQuery(text:string){
  setInputValue(text);setQuery(text);setPerson(null);
  setDuplicateConflict(false);setError("");setOpen(true);setActive(0);
 }
 // PAP-1742: stop the *first* Escape while the listbox is open before the
 // native document-level Drawer Escape listener can close the whole dialog.
 function onComboboxKeyDownCapture(e:KeyboardEvent<HTMLInputElement>){
  if(e.key==="Escape"&&open){e.preventDefault();e.stopPropagation();setOpen(false);}
 }
 function onComboboxKeyDown(e:KeyboardEvent<HTMLInputElement>){
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
   e.preventDefault();
   if(!open){setOpen(true);setActive(0);return;}
   if(visibleMatches.length)setActive(i=>(i+(e.key==="ArrowDown"?1:-1)+visibleMatches.length)%visibleMatches.length);
  }else if(e.key==="Enter"&&open){
   e.preventDefault();if(visibleMatches[active])choose(visibleMatches[active]);
  }else if(e.key==="Escape"&&open){
   e.preventDefault();e.stopPropagation();setOpen(false);
  }
 }
 const close=()=>{if(saving)return;onClose();};
 async function create(){
  if(!canCreate||!person){if(!duplicate)setError("Vui lòng chọn Person đủ điều kiện.");return;}
  const chosen=person;
  setSaving(true);setError("");
  try{
   const response=await fetch("/api/bo/pinoria/avatars?"+new URLSearchParams({centerId}),{
    method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
    body:JSON.stringify({personId:chosen.personId,...(nickname.trim()?{nickname:nickname.trim()}:{} )}),cache:"no-store"
   });
   if(response.status===409){setDuplicateConflict(true);setError("");return;}
   if(response.status!==201){setError(errorFor(response.status));return;}
   const body:unknown=await response.json();
   const data=body&&typeof body==="object"&&"data" in body?(body as {data?:{id?:unknown;personId?:unknown}}).data:null;
   if(!data||typeof data.id!=="string"||data.personId!==chosen.personId)
    throw Error("Chưa xác nhận được Avatar vừa tạo. Kiểm tra danh sách trước khi thử lại.");
   onCreated();
  }catch(e){setError(e instanceof Error?e.message:"Không thể xác nhận thao tác.");}
  finally{setSaving(false);}
 }
 const drawerFields=toLegacyModule(selfSchema as unknown as Parameters<typeof toLegacyModule>[0]).fields;
 const drawerEditableFields=drawerFields.filter(field=>field.key==="name"||field.key==="nickname");
 const auditFields=drawerFields.filter(field=>["createdAt","createdBy","updatedAt","updatedBy"].includes(field.key));
 const draft:BoRecord={id:"",name:inputValue,nickname,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
 const personPicker=(
     <div className={styles.picker}>
      <input id="ps-create-person" ref={inputRef} autoFocus type="text" role="combobox"
       aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
       aria-activedescendant={open&&visibleMatches[active]?listId+"-"+active:undefined}
       aria-describedby="ps-create-person-hint" aria-invalid={!!inputValue&&!person}
       placeholder="Chọn hoặc tìm Person…" className="pds-property-input" value={inputValue} maxLength={120}
       autoComplete="off" disabled={saving}
       onFocus={()=>{setOpen(true);setActive(0);}}
       onClick={()=>{setOpen(true);setActive(0);}}
       onChange={e=>changeQuery(e.target.value)}
       onKeyDown={onComboboxKeyDown} onKeyDownCapture={onComboboxKeyDownCapture}
       onBlur={()=>{setTimeout(()=>{if(document.activeElement!==inputRef.current)setOpen(false);},120);}}/>
      {open?<div className={styles.options} id={listId} role="listbox" aria-label="Chọn Person" data-avatar-person-options="">
       {loading?<p role="status">Đang tìm Person tại cơ sở đã chọn…</p>:
        loadError?<div role="alert">{loadError} <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setRetry(n=>n+1)}>Thử lại</button></div>:
        visibleMatches.length?visibleMatches.map((option,i)=>
         <button ref={el=>{optionRefs.current[i]=el;}} type="button" role="option"
          id={listId+"-"+i} aria-selected={i===active}
          className="secondary-btn ps-avatar-person-option"
          key={option.personId} onMouseDown={e=>e.preventDefault()}
          onMouseEnter={()=>setActive(i)} onClick={()=>choose(option)}>
          <span className={styles.optionCopy}><strong>{option.displayName}</strong><small>{option.subjectTypes.join(" / ")}</small></span>
          <span className="ps-avatar-person-option-state">{candidateHasAvatar(option)?"Đã có Avatar":"Chưa có Avatar"}</span>
         </button>):
        <p role="status">Không có Person phù hợp tại cơ sở này.</p>}
       {!loading&&matches.length>visibleMatches.length?<p role="status">Đang hiển thị 8 kết quả đầu. Gõ để tìm thêm.</p>:null}
       {!loading&&hasMore?<p role="status">Danh sách bị giới hạn. Gõ tên Person để tìm thêm.</p>:null}
      </div>:null}
     </div>
 );
 // PAP-1742: the default bare property-control input has no visible DS border;
 // opt into the shared row's control slot, not a cloned property-row/label.
 const nicknameControl=(
  <input id="ps-create-nickname" type="text" ref={nicknameRef}
   className="pds-property-input" placeholder="Tên hiển thị của Avatar"
   maxLength={40} autoComplete="off" disabled={saving} value={nickname}
   onChange={e=>{setNickname(e.target.value);setError("");}}/>
 );
 const footer=<>
  <BoActionButton type="button" variant="secondary" onClick={close} disabled={saving}>Hủy</BoActionButton>
  <BoActionButton type="button" variant="primary" onClick={()=>void create()} disabled={!canCreate}>
   {duplicate?"Đã có Avatar":saving?"Đang tạo…":person?"Tạo Avatar":"Chọn Person"}
  </BoActionButton>
 </>;
 return <DrawerFrame title="Tạo Avatar" path="Pinoria · Avatar" onClose={close} footer={footer}>
  <div className={styles.body} data-jira="PAP-1734" data-avatar-schema="PAP-1734" data-avatar-mode="CREATE">
   <PropertySections variant="drawer" fields={drawerEditableFields} record={draft} sections={selfDefinition.drawer.sections} createFields={{
     name: {id:"ps-create-person",label:"Person *",required:true,value:inputValue,onChange:changeQuery,control:personPicker},
     nickname: {id:"ps-create-nickname",label:"Nickname Avatar (tùy chọn)",value:nickname,onChange:value=>{setNickname(value);setError("");},control:nicknameControl},
   }}/>
   <p id="ps-create-person-hint" className="pino-avatar-hint">
    Chỉ chọn Person thuộc cơ sở hiện tại. Người đã có Avatar được đánh dấu để tránh tạo trùng.
   </p>
   {duplicate?<p role="status" className="pino-avatar-duplicate">Person này đã có Avatar. Không thể tạo bản ghi trùng.</p>:null}
   <p className="pino-avatar-hint">Nickname không đổi tên Person. Avatar không tự nhận Starter Set hay Item.</p>
   <PropertySections variant="drawer" fields={auditFields} record={draft} sections={selfDefinition.drawer.sections}/>
   {error?<p className="pino-avatar-error" role="alert">{error}</p>:null}
  </div>
 </DrawerFrame>;
}
