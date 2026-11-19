/** PAP-2161 synthetic native UI preview. Never included in product route. */
import React,{useMemo} from "react";
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {BoCenterSelectionProvider,useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {unifiedBoWorkspaceSource} from "@/app/bo/architecture/bo-unified-workspace-source";
import {hoModules,hoRoutes,type HoModule} from "@/lib/ho-system";
import {WorkshopWorkspace,checkWorkshop,type WorkshopRow,type WorkshopInput,type WorkshopPort,type VersionedWorkshop} from "@/app/components/mytime-workshop/WorkshopWorkspace";
import {ictWorkshopInstant} from "@/app/components/mytime-workshop/api-client";
import {workshopBinding,type WorkshopCapabilities} from "@/app/components/mytime-workshop/schema";
import type {AuthorizationContext} from "@/lib/workspace-schema";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const A="019d2161-0000-7000-8000-000000000001",B="019d2161-0000-7000-8000-000000000002",cA="PINO House A",cB="PINO House B";
const choices={centers:[cA,cB],missions:["Moonlit City","Pink Hour","Under the Same Sky","Mediterranean Balcony"],specialties:["Daydream Club","Summer Coast"],staff:["QA Nguyễn Minh An","QA Trần Thanh Hà","QA Lê Bảo Nam","QA Phạm Thu Linh","QA Võ Gia Hân"]};
const cap:WorkshopCapabilities={read:"fixture.workshop.read",create:"fixture.workshop.create",edit:"fixture.workshop.edit",history:"fixture.workshop.history"};
const row=(id:string,name:string,center:string,startAt:string,endAt:string,missions:string[],specialty:string|null,capacity:number):VersionedWorkshop=>({version:"1",row:{id,name,center,startAt,endAt,missions,specialty,capacity,status:"Đã lên lịch",eventLead:choices.staff[0],academicLead:choices.staff[1],otherStaff:choices.staff.slice(2,4),facebookUrl:null,note:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null}});
const sample=[row("w-1","Daydream cuối tuần",cA,"2026-11-21T14:00:00+07:00","2026-11-21T17:00:00+07:00",["Moonlit City","Pink Hour"],"Daydream Club",12),row("w-2","Một buổi chiều sáng tạo",cA,"2026-11-22T14:00:00+07:00","2026-11-22T17:00:00+07:00",["Under the Same Sky"],null,8),row("w-3","Mediterranean Balcony",cB,"2026-11-28T14:00:00+07:00","2026-11-28T17:00:00+07:00",["Mediterranean Balcony"],null,10)];
const surface=location.pathname.startsWith("/ho/")?"HO":"BO";
const binding=workshopBinding(surface,choices,cap);
const source:BoWorkspaceSource={modules:{...(surface==="HO"?hoModules:unifiedBoWorkspaceSource.modules),"mytime-workshops":binding.module},surface:surface==="HO"?"ho":undefined,routeForModule:k=>k==="mytime-workshops"?"/"+surface.toLowerCase()+"/mytime-workshops":surface==="HO"?hoRoutes[k as HoModule]??"/ho":unifiedBoWorkspaceSource.routeForModule!(k),readOnly:surface==="BO",ephemeral:true,scopeLabel:()=>"",load:async()=>{throw Error("No runtime adapter");}};
const state=new URLSearchParams(location.search).get("qaState");
function portFor(initial:VersionedWorkshop[],ctx:AuthorizationContext):WorkshopPort{
 const records=new Map(initial.map(x=>[x.row.id,x]));
 const attempts=new Map<string,VersionedWorkshop>();
 const valid=(input:WorkshopInput)=>checkWorkshop(input)||(!choices.centers.includes(input.center)||input.missions.some(x=>!choices.missions.includes(x))||input.specialty&&!choices.specialties.includes(input.specialty)||[input.eventLead,input.academicLead,...input.otherStaff].some(x=>x&&!choices.staff.includes(x))?"Lựa chọn không hợp lệ.":"");
 const inputFrom=(value:WorkshopRow):WorkshopInput=>({name:String(value.name??""),center:String(value.center??""),startAt:String(value.startAt??""),endAt:String(value.endAt??""),missions:[...(value.missions??[])],specialty:value.specialty??null,capacity:value.capacity??null,eventLead:value.eventLead??null,academicLead:value.academicLead??null,otherStaff:[...(value.otherStaff??[])],facebookUrl:value.facebookUrl??null,note:value.note??null});
 return {cancel:async(id,version,key)=>{if(ctx.surface!=="HO"||!ctx.authorize(cap.edit))throw Error("Không có quyền hủy.");if(attempts.has(key))return attempts.get(key)!;const prior=records.get(id);if(!prior||prior.version!==version||prior.row.status==="Đã hủy")throw Error("Workshop đã thay đổi.");const result:VersionedWorkshop={row:{...prior.row,status:"Đã hủy"},version:String(Number(version)+1)};records.set(id,result);attempts.set(key,result);return result;},create:async(input,key)=>{if(ctx.surface!=="HO"||!ctx.authorize(cap.create))throw Error("Không có quyền tạo.");if(attempts.has(key))return attempts.get(key)!;const error=valid(input);if(error)throw Error(error);const item:VersionedWorkshop={version:"1",row:{...input,startAt:ictWorkshopInstant(input.startAt),endAt:ictWorkshopInstant(input.endAt),status:"Đã lên lịch",id:crypto.randomUUID?.()??"qa-"+Date.now(),createdAt:null,createdBy:null,updatedAt:null,updatedBy:null}};records.set(item.row.id,item);attempts.set(key,item);return item;},
 update:{update:async(id,patch,version,context,signal)=>{signal.throwIfAborted();if(context!==ctx||ctx.surface!=="HO"||!ctx.authorize(cap.edit))return {status:"denied"};const previous=records.get(id);if(!previous||previous.row.status==="Đã hủy")return {status:"denied"};if(version!==previous.version)return {status:"conflict"};const row={...previous.row,...patch};if(valid(inputFrom(row)))return {status:"invalid",fields:Object.keys(patch) as (keyof WorkshopInput)[]};row.startAt=ictWorkshopInstant(String(row.startAt));row.endAt=ictWorkshopInstant(String(row.endAt));const next=String(Number(version)+1);records.set(id,{row,version:next});return {status:"saved",row,version:next};}}};
}
function HoFeature(){
 const ctx=useMemo<AuthorizationContext>(()=>({surface:"HO",authorize:p=>state!=="denied"&&(p===cap.read||state!=="readonly"&&[cap.create,cap.edit].includes(p))}),[]);
 const rows=useMemo(()=>state==="empty"?[]:sample,[]);
 const port=useMemo(()=>portFor(rows,ctx),[rows,ctx]);
 return <WorkshopWorkspace binding={binding} context={ctx} initialRows={rows} port={port}/>;
}
function BoFeature(){
 const selection=useBoCenterSelection(),id=selection?.selected??"",label=id===A?cA:id===B?cB:"";
 const ctx=useMemo<AuthorizationContext>(()=>({surface:"BO",centerId:id,authorize:p=>state!=="denied"&&!!label&&p===cap.read}),[id,label]);
 const rows=useMemo(()=>state==="empty"?[]:sample.filter(x=>x.row.center===label),[label]);
 if(selection?.loading)return <p role="status">Đang tải…</p>;
 if(!label)return <p role="alert">Không có cơ sở được cấp quyền.</p>;
 return <WorkshopWorkspace key={id} binding={binding} context={ctx} initialRows={rows}/>;
}
const app=<BoRegistrationWorkspace currentUser={{displayName:surface==="HO"?"Founder":"Manager"}} moduleKey="mytime-workshops" source={source} content={surface==="HO"?<HoFeature/>:<BoFeature/>}/>;
createRoot(document.getElementById("root")!).render(surface==="HO"?app:<BoCenterSelectionProvider>{app}</BoCenterSelectionProvider>);
