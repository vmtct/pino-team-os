"use client";
// PAP-1772 · Entirely fictional guardian & learner fixtures; no actual identity or student records.
import { useEffect, useState } from "react";
export type ProfileId = "an" | "binh" | "mai";
export type PinerProfile = {
 id: ProfileId; display: string; short: string; alias: string;
 avatar: string; program: string; kind: "child" | "adult";
};
export const PROFILES: readonly PinerProfile[] = [
 {id:"an",display:"Bé An",short:"An",alias:"Piner An",avatar:"A",program:"Hội Họa · Piano",kind:"child"},
 {id:"binh",display:"Bé Bình",short:"Bình",alias:"Piner Bình",avatar:"B",program:"Hội Họa · Piano",kind:"child"},
 {id:"mai",display:"Chị Mai",short:"Mai",alias:"Piner Mai",avatar:"M",program:"MyTime · Acrylic & Piano",kind:"adult"}
] as const;
export const MANAGED_CHILDREN = PROFILES.filter(profile=>profile.kind==="child");
export const PROFILE_STORAGE_KEY = "piner-pap1772-selected-child";
export function getProfile(id:ProfileId): PinerProfile{
 return PROFILES.find(profile=>profile.id===id)??PROFILES[0];
}
export function isManagedChild(id:ProfileId): boolean{
 return MANAGED_CHILDREN.some(profile=>profile.id===id);
}
export function useActiveProfile(){
 const [activeId,setActiveId]=useState<ProfileId>("an");
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{
   try{
     const saved=window.sessionStorage.getItem(PROFILE_STORAGE_KEY);
     if(saved && (saved==="an" || saved==="binh"))setActiveId(saved);
   }catch{/* Browsers may disable storage: use default fictional profile. */}
   setHydrated(true);
 },[]);
 const select=(id:ProfileId)=>{
   if(!isManagedChild(id))return; // Guardians cannot impersonate a community-only adult.
   setActiveId(id);
   try{window.sessionStorage.setItem(PROFILE_STORAGE_KEY,id);}
   catch{/* Prototype remains functional in memory only. */}
 };
 return {profile:getProfile(activeId),activeId,select,hydrated};
}
