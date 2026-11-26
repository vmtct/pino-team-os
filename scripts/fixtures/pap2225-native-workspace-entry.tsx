/** PAP-1037 / PAP-1043 / PAP-2225: isolated mounted native workspace regression. No live authentication or transport. */
import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {openRunningClassProvider,type RunningClassProvider} from "@/app/bo/running-classes/running-class-provider";
import {classTableModule,type ClassRecord} from "@/app/bo/running-classes/running-class-presentation";
import type {ClassCreate} from "@/app/bo/running-classes/running-class-draft";
import school from "@/public/bo-authority-source/school-adapters.js";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
const id=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0");
const C=id(1),P=id(2),S=id(3),U=id(4),R=id(5);
const options={centerId:C},user={displayName:"QA Synthetic"};
const lost=new URLSearchParams(location.search).has("lost");
let row:ClassRecord|undefined,createCalls=0,editCalls=0,firstKey="",firstBody="";
const receipt=()=>{const e=document.querySelector("#synthetic-receipt");if(e)e.textContent=JSON.stringify({createCalls,editCalls,version:row?.version??0,name:row?.operationalName??"",status:row?.status??"",id:row?.id??null});};
const json=(data:unknown,status=200)=>Response.json({data},{status});
const fetcher:typeof fetch=async(input,init)=>{
 const url=new URL(String(input),location.origin),method=init?.method??"GET";
 if(url.origin!==location.origin||url.searchParams.size!==1||url.searchParams.get("centerId")!==C)throw Error("Unexpected synthetic scope.");
 if(method==="GET"&&url.pathname==="/api/bo/delivery/bootstrap-state")return json({centers:[{id:C,status:"ACTIVE",displayName:"QA Center",timeZone:"Asia/Ho_Chi_Minh"}],paths:[{id:P,status:"ACTIVE",displayName:"Piano"}],learningSpaces:[{id:S,centerId:C,status:"ACTIVE",displayName:"QA Room"}],runningClasses:row?[row]:[]});
 const h=new Headers(init?.headers);if(h.get("x-pino-expected-principal")!==U)throw Error("Actor mismatch.");
 const body=String(init?.body);
 if(method==="POST"&&url.pathname==="/api/bo/delivery/running-classes/create-inactive"){
  createCalls++;const key=h.get("idempotency-key");if(!key)throw Error("Missing key");
  if(row){if(key!==firstKey||body!==firstBody)throw Error("Create retry drift");receipt();return json(row,201);}
  const command=JSON.parse(body) as ClassCreate;
  if(command.centerId!==C||command.status!=="INACTIVE")throw Error("Invalid create");
  firstKey=key;firstBody=body;row={...command,id:R,version:1};receipt();
  if(lost)throw Error("Synthetic lost create ACK");
  return json(row,201);
 }
 if(method==="PATCH"&&url.pathname==="/api/bo/delivery/running-classes/"+R+"/inline"&&row){
  const {expectedVersion,...changes}=JSON.parse(body);
  if(expectedVersion!==row.version)throw Error("Stale version");
  editCalls++;row={...row,...changes,version:row.version+1};receipt();return json(row);
 }
 throw Error("Unexpected synthetic operation "+method+" "+url.pathname);
};
function Fixture(){
 const [session,setSession]=useState<{provider:RunningClassProvider;source:BoWorkspaceSource}|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  let active=true,own:RunningClassProvider|undefined;
  void openRunningClassProvider({centerId:C,context:async()=>({userId:U,surface:"BO",entitled:true,permissionKeys:["delivery.schedule.manage"]}),selectedCenter:()=>active?C:"",fetcher,storage:sessionStorage}).then(provider=>{
   own=provider;if(!active){provider.dispose();return;}
   setSession({provider,source:{modules:{...school.modules,classes:classTableModule(school.modules.classes)},runningClassLive:provider,scopeLabel:()=>"",routeForModule:k=>k==="classes"?"/bo/running-classes":"/bo?module="+k,load:async(k,_f,o)=>{if(k!=="classes"||o.centerId!==C)throw Error("Scope mismatch");return provider.load();}}});
  }).catch(e=>{if(active)setError(String(e));});
  return()=>{active=false;own?.dispose();};
 },[]);
 if(error)return <p role="alert">{error}</p>;
 if(!session)return <p>Loading synthetic fixture</p>;
 return <><output hidden id="synthetic-receipt">{JSON.stringify({createCalls,editCalls,version:0})}</output><BoRegistrationWorkspace source={session.source} moduleKey="classes" options={options} currentUser={user}/></>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
