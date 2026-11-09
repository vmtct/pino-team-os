"use client";
/** PAP-1385 / PAP-650 PNR-TV: non-persistent FE-only logical TV visibility editor.
 * Scope/centerIds here are NOT Core Policy ownership/identity or authorization.
 * No POST, localStorage, fake Core writer, or cross-browser persistence.
 */
import {useState} from "react";
import type {BoField,BoRecord,BoValue} from "@/lib/bo-registration";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";

export type TvVisibilityCenter = Readonly<{id:string;name:string}>;
type Scope = "DEFAULT"|"CENTER";
type LocalDraft = {name:string;scope:Scope;centerIds:string[]};
const sections=[{id:"visibility-fe-preview",label:"Hiển thị trên TOS · Mô phỏng FE",fields:["name","visibilityScope","centerIds"]}];

export function TvPolicyVisibilityPreview({policy,centers}:{
  policy:BoRecord;centers:readonly TvVisibilityCenter[];
}){
  const [draft,setDraft]=useState<LocalDraft>(()=>({name:policy.name,scope:"CENTER",centerIds:[]}));
  const [editor,setEditor]=useState<{field:BoField;anchor:HTMLButtonElement}|null>(null);
  const options=centers.map(c=>({id:c.id,label:c.name+" · "+c.id.slice(-6)}));
  const fields:BoField[]=[
    {key:"name",label:"Tên TV",type:"text",icon:"Aa",w:220},
    {key:"visibilityScope",label:"Scope hiển thị",type:"select",icon:"",w:150,options:["DEFAULT","CENTER"]},
    {key:"centerIds",label:"Center hiển thị",type:"multiselect",icon:"",w:240,
      options:options.map(c=>c.label)},
  ];
  const record:BoRecord={id:policy.id,name:draft.name,visibilityScope:draft.scope,
    centerIds:options.filter(c=>draft.centerIds.includes(c.id)).map(c=>c.label)};
  const canEdit=(field:BoField)=>field.key!=="centerIds"||(draft.scope==="CENTER"&&options.length>0);
  const save=(field:BoField,value:BoValue)=>{
    if(field.key==="name"){
      const next=String(value??"").trim();
      if(next.length>0&&next.length<=200)setDraft(v=>({...v,name:next}));
    }else if(field.key==="visibilityScope"&&(value==="DEFAULT"||value==="CENTER")){
      setDraft(v=>({...v,scope:value as Scope,centerIds:[]}));
    }else if(field.key==="centerIds"&&Array.isArray(value)){
      const ids=options.filter(c=>value.includes(c.label)).map(c=>c.id);
      setDraft(v=>v.scope==="CENTER"?{...v,centerIds:ids}:v);
    }
  };
  return <section data-pnr-tv-fe-only-preview="" data-pnr-tv-persisted="false"
    aria-label="Mô phỏng phân phối TV trên TOS">
    <p role="status">Mô phỏng FE — mọi chỉnh sửa ở đây chỉ tồn tại trong phiên xem hiện tại,
      không được lưu vào Core và không đồng bộ sang trình duyệt TOS khác.
      Scope hiển thị độc lập với Scope/Center của Policy Core bên trên.</p>
    <PropertySections fields={fields} record={record} sections={sections} variant="detail"
      canEdit={canEdit} onEdit={(field,anchor)=>setEditor({field,anchor})}/>
    {editor?<BoTypedEditor key={editor.field.key} field={editor.field}
      value={record[editor.field.key]} anchor={editor.anchor}
      onSave={v=>save(editor.field,v)} onClose={()=>setEditor(null)}/>:null}
    <p role="status" data-pnr-tv-draft-center-count={draft.centerIds.length}>
      {draft.scope==="DEFAULT"?"Mô phỏng: mọi Center đã được xác thực":
        draft.centerIds.length?"Mô phỏng: "+draft.centerIds.length+" Center được chọn":
          "Mô phỏng: chưa có Center nào được chọn (ẩn trên TOS)"}.
      Viewer chưa được cấp quyền. Không tạo hoặc chuyển chủ sở hữu Policy.
    </p>
  </section>;
}
