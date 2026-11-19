"use client";
import {useLayoutEffect,useRef,useState} from "react";
import type {TddActionBindings,TddActionResult} from "@/lib/workspace-schema";
import {roleCreateInput,verifyCreatedRole,type RoleCreateInput,type RoleDraft} from "./role-lifecycle-model";
export {roleCreateActions} from "./role-lifecycle-model";
const emptyDraft=():RoleDraft=>({roleKey:"",displayName:"",description:""});
export type RoleCreateOutcome={state:Exclude<TddActionResult["state"],"verified">}|{state:"verified";receipt:unknown};
/** Native presentation controller. No HTTP or authority; adapter must supply persisted readback. */
export function useRoleCreateFlow(authorized:boolean,submit:((input:RoleCreateInput)=>Promise<RoleCreateOutcome>)|undefined,onVerified:()=>void){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<RoleDraft>(emptyDraft),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const lock=useRef(false),uncertainLock=useRef(false),openLock=useRef(false),generation=useRef(0),current=useRef({authorized,submit});
 useLayoutEffect(()=>{current.current={authorized,submit};},[authorized,submit]);
 const allowed=authorized&&!!submit;
 const input=roleCreateInput(draft);
 const [drawerGeneration,setDrawerGeneration]=useState(0);
 const close=()=>{if(!lock.current){openLock.current=false;setOpen(false);}};
 const bindings:TddActionBindings=allowed&&!uncertain?{
  openCreate:{kind:"navigation",run:()=>{if(!current.current.authorized||!current.current.submit||lock.current||uncertainLock.current||openLock.current)return;generation.current++;setDrawerGeneration(generation.current);openLock.current=true;setDraft(emptyDraft());setOpen(true);}},
  cancelCreate:{kind:"navigation",disabled:busy,run:close},
  saveCreate:{kind:"mutation",disabled:busy||!input,run:async()=>{
   const active=current.current;
   if(!active.authorized||!active.submit)return{state:"denied"};
   if(uncertainLock.current)return{state:"unverified"};
   if(!input||lock.current||!openLock.current||drawerGeneration!==generation.current)return{state:"invalid"};
   lock.current=true;setBusy(true);
   try{
     const result=await active.submit(input);
     if(result.state!=="verified"){if(result.state==="unverified"){uncertainLock.current=true;openLock.current=false;setUncertain(true);}return{state:result.state};}
     if(!verifyCreatedRole(input,result.receipt)){uncertainLock.current=true;openLock.current=false;setUncertain(true);return{state:"unverified"};}
     openLock.current=false;setOpen(false);onVerified();return{state:"verified"};
   }catch{uncertainLock.current=true;openLock.current=false;setUncertain(true);return{state:"unverified"};}
   finally{lock.current=false;setBusy(false);}
  }}
 }: {};
 return {open:open&&allowed&&!uncertain,draft,setDraft,busy,uncertain,close,bindings};
}
