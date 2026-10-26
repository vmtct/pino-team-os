"use client";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { boApi } from "@/lib/bo-api";
import { hoRoutes, hoModules, mapHoCenters, mapHoUsers, mapHoRoles, type HoModule } from "@/lib/ho-system";
import type { ReactNode } from "react";
const source: BoWorkspaceSource = {
 modules:hoModules, surface:"ho",readOnly:true,
 routeForModule:key=>hoRoutes[key as HoModule] ?? hoRoutes.centers,
 scopeLabel:()=>"",
 async load(key,fetcher) {
  const timed:typeof fetch=(url,init)=>fetcher(url,{...init,signal:init?.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(key==="centers") return mapHoCenters(await boApi.centers(timed));
  if(key==="users") return mapHoUsers(await boApi.accessUsers(timed));
  if(key==="roles") {
    const roles=await boApi.accessRoles(timed);
    const details=[];
    // Avoid unbounded concurrent privileged requests if roles scale beyond the current staging data.
    for (let i=0;i<roles.length;i+=4) details.push(...await Promise.all(roles.slice(i,i+4).map(role=>boApi.accessRole(role.id,timed))));
    return mapHoRoles(roles,details);
  }
  return []; // Audit table manages true server-side pagination in HoAccessAudit.
 },
};
export function HoWorkspace({module,content}:{module:HoModule;content?:ReactNode}) {
 return <BoRegistrationWorkspace source={source} moduleKey={module} currentUser={{displayName:null}} content={content}/>;
}
