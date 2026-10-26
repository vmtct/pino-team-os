"use client";
import { useEffect, useMemo, useState } from "react";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { HoAccessAudit } from "@/app/ho/system/audit/HoAccessAudit";
import { hoModules, hoRoutes, type HoModule } from "@/lib/ho-system";
import { protoRoutes, protoModules } from "@/lib/ho-proto-a23";
import { prodCounts, protoAuditRows, protoRows, type FixtureMode } from "@/lib/ho-proto-fixtures";
import type { BoAccessAuditPage } from "@/lib/bo-api";

const allModules={...hoModules,...protoModules};
const allRoutes:Record<string,string>={...hoRoutes,...protoRoutes};
/** Protected production traffic is never reachable: source reads deterministic in-memory fixtures. */
export function HoPrototypeWorkspace({module}:{module:HoModule | keyof typeof protoModules}) {
 const [mode,setMode]=useState<FixtureMode>("demo");
 useEffect(()=>{
  const fromQuery=new URLSearchParams(window.location.search).get("fixture");
  const m:FixtureMode=fromQuery==="production"||fromQuery==="demo"?fromQuery:
    sessionStorage.getItem("ho-proto-fixture")==="production"?"production":"demo";
  sessionStorage.setItem("ho-proto-fixture",m);
  setMode(m);
 },[]);
 const source=useMemo<BoWorkspaceSource>(()=>({
  modules:allModules,readOnly:true,surface:"ho",
  routeForModule:key=>allRoutes[key]||"/ho/centers",
  scopeLabel:() => "",
  async load(key){
    return protoRows(key,mode);
  }
 }),[mode]);
 const change=(next:FixtureMode)=>{
  sessionStorage.setItem("ho-proto-fixture",next);
  setMode(next);
 };
 const loadAudit=async({limit,offset,query,outcome}:{limit:number;offset:number;query?:string;outcome?:string}):Promise<BoAccessAuditPage>=>{
  const filter=protoAuditRows.filter(x=>
    (!outcome||x.outcome===outcome)&&
    (!query||[x.action,x.actorType,x.actorId,x.subjectId,x.requestId].join(" ").toLowerCase().includes(query.toLowerCase()))
  );
  const total=filter.length,page=Math.floor(offset/limit)+1,pageCount=Math.ceil(total/limit);
  return {events:filter.slice(offset,offset+limit),page:{
   limit,offset,total,page,pageCount,hasPrevious:page>1,hasNext:page<pageCount
  }} as BoAccessAuditPage;
 };
 return <>
  <BoRegistrationWorkspace key={module+mode} moduleKey={module} currentUser={{displayName:null}} source={source}
   content={module==="audits"?<HoAccessAudit loadPage={loadAudit}/>:undefined}/>
  <aside className="ho-proto-float" aria-label="Prototype fixture mode">
   <span className="ho-proto-marker">PROTOTYPE · DỮ LIỆU GIẢ LẬP</span>
   <button type="button" aria-pressed={mode==="demo"} onClick={()=>change("demo")}>Demo QA</button>
   <button type="button" aria-pressed={mode==="production"} onClick={()=>change("production")}>Production snapshot</button>
   <span className="ho-proto-baseline">D1 aggregate 26/10 · {prodCounts.centers} Centers · {prodCounts.users} Users</span>
  </aside>
 </>;
}
