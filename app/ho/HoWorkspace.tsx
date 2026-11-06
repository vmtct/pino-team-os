"use client";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { boApi } from "@/lib/bo-api";
import { hoRoutes, hoModules, mapHoCenters, mapHoUsers, mapHoRoleDirectory, type HoModule } from "@/lib/ho-system";
import { HO_A1_KEYS,loadHoA1,loadHoA1Detail,type HoA1Module } from "@/lib/ho-a1";
import { useEffect, useState, type ReactNode } from "react";
import type { TddStage } from "@/app/components/workspace-renderer/Renderer";
import type { FieldSchema } from "@/lib/workspace-schema";
import type { SurfaceWorkspaceProps } from "@/app/components/workspace-adapters/SurfaceWorkspace";
const source: BoWorkspaceSource = {
 modules:hoModules, surface:"ho",readOnly:true,
 routeForModule:key=>hoRoutes[key as HoModule] ?? hoRoutes.centers,
 scopeLabel:()=>"",
 async load(key,fetcher) {
  const timed:typeof fetch=(url,init)=>fetcher(url,{...init,signal:init?.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(HO_A1_KEYS.includes(key as HoA1Module))return loadHoA1(key as HoA1Module,timed);
  if(key==="centers") return mapHoCenters(await boApi.centers(timed));
  if(key==="users") return mapHoUsers(await boApi.accessUsers(timed));
  if(key==="roles") return mapHoRoleDirectory(await boApi.accessRoles(timed));
  return []; // Audit table manages true server-side pagination in HoAccessAudit.
 },
 async loadRecordDetails(key,record,fetcher) {
  const timed:typeof fetch=(url,init)=>fetcher(url,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(key==="roles") {
   const detail=await boApi.accessRole(record.id,timed);
   if(detail.id!==record.id)throw new Error("Role detail identity mismatch");
   return {...record,permissionKeys:detail.permissionKeys};
  }
  if(key==="syllabi")return loadHoA1Detail("syllabi",record,timed);
  return record;
 },
};
export function HoWorkspace<F extends readonly FieldSchema[] = readonly FieldSchema[]>({module,content,tdd,tddAdapter}:{module:HoModule;content?:ReactNode;tdd?:TddStage<F>;tddAdapter?:SurfaceWorkspaceProps<F>}) {
 const [displayName, setDisplayName] = useState<string | null>(null);
 useEffect(() => {
   const controller = new AbortController();
   void fetch("/api/bo/context", { cache: "no-store", signal: controller.signal })
     .then(async response => {
       if (!response.ok) throw Error("Unavailable");
       const payload = await response.json() as { data?: { displayName?: unknown; staffMemberId?: unknown; email?: unknown } };
       const context = payload.data;
       if (typeof context?.displayName === "string" && context.displayName.trim()) {
         if (!controller.signal.aborted) setDisplayName(context.displayName.trim());
         return;
       }
       if (typeof context?.staffMemberId === "string" && context.staffMemberId) {
         try {
           const staff = (await boApi.staffRecords()).find(item => item.id === context.staffMemberId);
           if (staff?.displayLabel?.trim()) {
             if (!controller.signal.aborted) setDisplayName(staff.displayLabel.trim());
             return;
           }
         } catch { /* Account label remains anchored to the authenticated email. */ }
       }
       if (!controller.signal.aborted && typeof context?.email === "string") setDisplayName(context.email);
     }).catch(() => { /* neutral fallback; no inferred identity */ });
   return () => controller.abort();
 }, []);
 return <BoRegistrationWorkspace source={source} moduleKey={module} currentUser={{displayName}} content={content} tdd={tdd} tddAdapter={tddAdapter}/>;
}
