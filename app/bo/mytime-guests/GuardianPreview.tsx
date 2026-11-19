"use client";
// PAP-2202 PLT-GUEST native guardian section; scoped canonical references supplied by the controller.
import {useState} from "react";
import {createPortal} from "react-dom";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import type {BoField,BoRecord,BoValue} from "@/lib/bo-registration";
export type GuardianDraft={category:string;guardianSource:string;guardianName:string;guardianPhone:string;guardianRelation:string};
export type GuardianOption={label:string;name:string;phone:string;id?:string};
export const blankGuardian=():GuardianDraft=>({category:"",guardianSource:"",guardianName:"",guardianPhone:"",guardianRelation:""});
export const guardianIssue=(v:GuardianDraft,phone:string)=>!["Người lớn","Trẻ em"].includes(v.category)?"Chọn nhóm tuổi của khách.":v.category==="Người lớn"?!phone.trim()?"Nhập số điện thoại khách.":"":!v.guardianSource||!v.guardianName.trim()||!v.guardianPhone.trim()||!v.guardianRelation?"Bổ sung đầy đủ thông tin người giám hộ.":"";
export function GuardianPreview({value,options,variant,editable,onChange,allowNew=true}:{value:GuardianDraft;options:readonly GuardianOption[];variant:"drawer"|"detail";editable:boolean;onChange:(v:GuardianDraft)=>void;allowNew?:boolean}){
 const [edit,setEdit]=useState<{field:BoField;anchor:HTMLElement}|null>(null);
 const isMinor=value.category==="Trẻ em",existing=options.some(x=>x.label===value.guardianSource);
 const guardian:BoField[]=[{key:"guardianSource",label:"Hồ sơ giám hộ",type:"relation",icon:"↗",w:180,options:[...(allowNew?["Nhập thông tin mới"]:[]),...options.map(x=>x.label)]},{key:"guardianName",label:"Họ tên người giám hộ",type:"text",icon:"Aa",w:200},{key:"guardianPhone",label:"Điện thoại người giám hộ",type:"text",icon:"Aa",w:180},{key:"guardianRelation",label:"Quan hệ",type:"select",icon:"▣",w:150,options:["Cha/mẹ","Người giám hộ","Khác"]}];
 const sections=[{id:"guest-guardian",label:"Người giám hộ",fields:guardian.map(f=>f.key)}];
 const save=(key:string,v:BoValue)=>{const text=String(v??"");let next={...value,[key]:text};if(key==="category"&&text!=="Trẻ em")next={...blankGuardian(),category:text};if(key==="guardianSource"){const match=options.find(x=>x.label===text);next={...next,guardianName:match?.name??"",guardianPhone:match?.phone??"",guardianRelation:""};}onChange(next);};
 if(!isMinor)return null;
 return <><PropertySections variant={variant} fields={guardian} sections={sections} record={{id:"preview",name:"",...value} as BoRecord} canEdit={f=>editable&&!(existing&&["guardianName","guardianPhone"].includes(f.key))} onEdit={(field,anchor)=>setEdit({field,anchor})}/>{edit?createPortal(<BoTypedEditor field={edit.field} value={value[edit.field.key as keyof GuardianDraft]} anchor={edit.anchor} onClose={()=>setEdit(null)} onSave={v=>save(edit.field.key,v)}/>,document.body):null}</>;
}
