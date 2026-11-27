"use client";
/** PAP-2412 / HO-MISSION-CRUD — PINO property editor for a narrowly admitted Mission command. Unmounted. */
import {useLayoutEffect,useRef,useState} from "react";
import {PropertyEditor,type PropertyField,type PropertyValue,type PropertyCommitResult} from "@pino/design-system/react";
import {MISSION_METADATA_COMMAND,missionPresentationSelection,type MissionMetadataPresentation,type MissionHost} from "./mission-inline-presentation";
import type {MissionInlineRequest,MissionInlineOutcome} from "./mission-inline-flow";
import {missionCategories,isMissionCategory} from "./mission-category";
import {normalizeMissionSupplementalUrl} from "./mission-supplemental-url";

type Field=typeof MISSION_METADATA_COMMAND.fields[number];
type Selection=NonNullable<ReturnType<typeof missionPresentationSelection>>;
type Eligibility=()=>boolean;
export type MissionMetadataBinding=Readonly<{
 command:typeof MISSION_METADATA_COMMAND;
 commit:(request:MissionInlineRequest,signal:AbortSignal,eligible:Eligibility)=>Promise<MissionInlineOutcome>;
}>;
type Props={
 host:MissionHost; schema:Parameters<typeof missionPresentationSelection>[0];
 context:Parameters<typeof missionPresentationSelection>[1];row:Readonly<Record<string,unknown>>;
 version:string|undefined;field:string;binding:MissionMetadataBinding;hasGenericWrites:boolean;
 anchor:HTMLElement;onClose:()=>void;onSaved:()=>void;
};
const selectionOnly:MissionMetadataPresentation={command:MISSION_METADATA_COMMAND,render:()=>null};
function selectionOf(props:Props){
 return props.binding.command===MISSION_METADATA_COMMAND?missionPresentationSelection(props.schema,props.context,selectionOnly,props.host,props.row,props.version,props.field,props.hasGenericWrites):null;
}
const pathLabels=["Artchitect","PianoHouse","Little Piner Art","Little Piner Piano"] as const;
const options=(values:readonly string[])=>values.map(value=>({value,label:value}));
export function missionPropertyField(key:Field,label:string):PropertyField{
 switch(key){
  case "category":return {key,label,type:"select",required:true,options:options(missionCategories)};
  case "path":return {key,label,type:"select",required:true,options:options(pathLabels)};
  case "level":return {key,label,type:"number",required:true,min:1,max:5};
  case "plsValue":return {key,label,type:"number",required:true,min:0,max:Number.MAX_SAFE_INTEGER};
  case "description":case "guideline":return {key,label,type:"textarea"};
  case "supplementalUrl":return {key,label,type:"url"};
  default:return {key,label,type:"text",required:true};
 }
}
export function normalizeMissionPropertyValue(field:Field,value:PropertyValue):{ok:true;value:PropertyValue}|{ok:false}{
 switch(field){
  case "name":case "code":{
   if(typeof value!=="string")return {ok:false};
   const clean=field==="code"?value.trim().toUpperCase():value.trim();
   return (field==="code"?/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(clean):!!clean&&clean.length<=160)?{ok:true,value:clean}:{ok:false};
  }
  case "category":return isMissionCategory(value)?{ok:true,value}:{ok:false};
  case "path":return typeof value==="string"&&pathLabels.some(v=>v===value)?{ok:true,value}:{ok:false};
  case "level":case "plsValue":
   return typeof value==="number"&&Number.isSafeInteger(value)&&(field==="level"?value>=1&&value<=5:value>=0)?{ok:true,value}:{ok:false};
  case "description":case "guideline":
   return value===null||(typeof value==="string"&&value.length<=(field==="description"?4000:8000))?{ok:true,value:value||null}:{ok:false};
  case "supplementalUrl":return normalizeMissionSupplementalUrl(value);
 }
}
export async function commitMissionProperty(selection:Selection,value:PropertyValue,binding:MissionMetadataBinding,eligible:Eligibility,signal:AbortSignal,onBlock:()=>void):Promise<PropertyCommitResult>{
 if(signal.aborted||!eligible()||binding.command!==MISSION_METADATA_COMMAND)return {status:"denied"};
 const next=normalizeMissionPropertyValue(selection.field,value);if(!next.ok)return {status:"error"};
 try{
  const outcome=await binding.commit({id:selection.id,expectedVersion:selection.expectedVersion,patch:{[selection.field]:next.value}},signal,eligible);
  if(outcome.status==="saved"&&!signal.aborted&&eligible()&&outcome.version===String(Number(selection.expectedVersion)+1))return {status:"saved",value:next.value};
  if(outcome.status==="saved"||outcome.status==="uncertain"||outcome.status==="conflict"){
   onBlock();return {status:"conflict"};
  }
  return {status:outcome.status==="denied"?"denied":"error"};
 }catch{onBlock();return {status:"error"};}
}
export function MissionMetadataPropertyHost(props:Props){
 const latest=useRef(props);
 useLayoutEffect(()=>{latest.current=props;},[props]);
 const blockedRef=useRef(false);
 const [blocked,setBlocked]=useState(false);
 const [reviewed]=useState(()=>({selection:selectionOf(props),binding:props.binding,context:props.context,host:props.host}));
 const matches=(current:Props)=>{
  const now=selectionOf(current),original=reviewed.selection;
  return !!now&&!!original&&now.id===original.id&&now.expectedVersion===original.expectedVersion&&now.field===original.field&&current.binding===reviewed.binding&&current.context===reviewed.context&&current.host===reviewed.host;
 };
 const selection=selectionOf(props);
 if(!selection||!matches(props))return null;
 const metadata=props.schema.fields.find(f=>f.key===selection.field);
 const label=(metadata as {label?:string}|undefined)?.label??selection.field;
 const eligible=()=>!blockedRef.current&&matches(latest.current);
 return <>{blocked?<p role="alert">Bản ghi cần được đối chiếu lại trước khi lưu.</p>:null}<PropertyEditor field={missionPropertyField(selection.field,label)} value={props.row[selection.field] as PropertyValue} anchor={props.anchor} surface="ho"
   canEdit={eligible} onClose={props.onClose} onSaved={()=>latest.current.onSaved()}
   onCommit={(value,{signal})=>commitMissionProperty(selection,value,reviewed.binding,eligible,signal,()=>{blockedRef.current=true;setBlocked(true);})}/></>;
}
