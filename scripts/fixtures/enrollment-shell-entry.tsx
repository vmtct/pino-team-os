/** PAP-2181 local synthetic fixture only. Not imported by runtime. */
import React from "react";
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {BoEnrollmentDirectory,type EnrollmentRow} from "@/app/bo/enrollments/BoEnrollmentDirectory";
import {enrollmentModule,READ} from "@/app/bo/enrollments/schema";
import {BoCenterSelectionProvider,useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import type {AuthorizationContext} from "@/lib/workspace-schema";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const id=(n:number)=>"019d2181-0000-7000-8000-"+String(n).padStart(12,"0");
const centerA=id(100),centerB=id(200);
const common={createdAt:"2026-11-10T02:00:00Z",createdBy:null,updatedAt:null,updatedBy:null};
const a:EnrollmentRow[]=[
 {id:id(1),name:"Nguyễn Minh An",subscription:"Piano · 12 buổi",runningClass:"Piano · T3 tối",path:"PianoHouse",schedule:"Thứ 3 · 18:00–19:30",start:"2026-11-10",end:null,...common},
 {id:id(2),name:"Nguyễn Minh An",subscription:"Piano · 12 buổi",runningClass:"Piano · T5 tối",path:"PianoHouse",schedule:"Thứ 5 · 18:00–19:30",start:"2026-11-10",end:null,...common},
 {id:id(3),name:"Trần Thanh Mai",subscription:"Art · 24 buổi",runningClass:"Art · T7 chiều",path:"Artchitect",schedule:"Thứ 7 · 16:00–17:30",start:"2026-10-01",end:"2026-11-15",...common},
];
const b:EnrollmentRow[]=[{id:id(4),name:"Lê Hoàng Nam",subscription:"Art · 12 buổi",runningClass:"Art · CN sáng",path:"Artchitect",schedule:"Chủ nhật · 09:00–10:30",start:"2026-11-01",end:null,...common}];
const q=new URLSearchParams(location.search);
const source={modules:{enrollments:enrollmentModule},readOnly:true,ephemeral:true,scopeLabel:()=>"",routeForModule:()=>"/bo/enrollments",load:async()=>{throw Error("Unexpected generic load")}};
if(location.pathname!=="/bo/enrollments"||!["127.0.0.1","192.168.1.6"].includes(location.hostname))throw Error("Local review only");
window.fetch=async(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.origin);if(url.origin===location.origin&&url.pathname==="/api/bo/centers"&&(init?.method??"GET")==="GET")return Response.json({data:[{id:centerA,displayName:"Cần Thơ"},{id:centerB,displayName:"Cơ sở B"}]});return new Response(null,{status:403});};
function Shell(){const selection=useBoCenterSelection();const selected=selection?.selected??"";const allowed=!!selected&&!selection?.loading&&!selection?.error&&q.get("state")!=="denied";const context:AuthorizationContext={surface:"BO",centerId:selected,authorize:p=>allowed&&p===READ};return <BoRegistrationWorkspace currentUser={{displayName:"Manager"}} moduleKey="enrollments" source={source} content={selection?.loading?<p role="status">Đang tải cơ sở…</p>:<BoEnrollmentDirectory key={selected} context={context} rows={q.get("state")==="empty"?[]:selected===centerA?a:b}/>}/>;}
createRoot(document.getElementById("root")!).render(<BoCenterSelectionProvider><Shell/></BoCenterSelectionProvider>);