"use client";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { boApi } from "@/lib/bo-api";
import { hoRoutes, hoModules, mapHoCenters, mapHoUsers, mapHoRoleDirectory, type HoModule } from "@/lib/ho-system";
import { HO_A1_KEYS,loadHoA1,loadHoA1Detail,type HoA1Module } from "@/lib/ho-a1";
import type { ReactNode } from "react";
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
 return <BoRegistrationWorkspace source={source} moduleKey={module} currentUser={{displayName:null}} content={content} tdd={tdd} tddAdapter={tddAdapter}/>;
}
