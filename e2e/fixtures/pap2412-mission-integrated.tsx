/** PAP-2412 / HO-MISSION-CRUD — browser test only; no product route or live transport. */
import {createRoot} from "react-dom/client";
import {TddRegistry,type AuthorizationContext,type ModuleRow} from "../../lib/workspace-schema";
import type {AuthenticatedSurfaceAdapter} from "../../lib/workspace-adapters";
import type {AdapterLocation,AdapterNavigation} from "../../lib/workspace-adapters/navigation";
import {HoMissionsContent,type MissionBoundary} from "../../app/ho/learning/missions/HoMissionsTdd";
import {TddPreferencePolicy} from "../../app/components/workspace-renderer/Record";
import {missionIntegratedDefinition,missionCategoryQuery,type missionFields} from "../../app/ho/learning/missions/schema";
import type {MissionInput} from "../../app/ho/learning/missions/command";
import {emptyMission} from "../../app/ho/learning/missions/MissionCreateFields";

type F=typeof missionFields;
const id="01900000-0000-7000-8000-000000002394";
const paths=[{id:"01900000-0000-7000-8000-000000000011",code:"artchitect",label:"Artchitect"},{id:"01900000-0000-7000-8000-000000000012",code:"pianohouse",label:"PianoHouse"},{id:"01900000-0000-7000-8000-000000000013",code:"little-piner-art",label:"Little Piner Art"},{id:"01900000-0000-7000-8000-000000000014",code:"little-piner-piano",label:"Little Piner Piano"}] as const;
const scenario=new URL(location.href).searchParams.get("scenario");
const context:AuthorizationContext=Object.freeze({surface:"HO",authorize:(key:string)=>key==="catalog.learning.view"||(scenario!=="readonly"&&key==="learning.mission.manage")});
let data:MissionInput={...emptyMission,name:"QA Mission",code:"QA-MISSION",category:"Staff Training",level:2,plsValue:30,pathProgramId:paths[0].id,pathKeySnapshot:paths[0].code,description:"Synthetic only",guideline:"Guide",supplementalUrl:"https://example.test/guide"},version=1,writes=0,serial=0;
let locationState:AdapterLocation<F>={kind:"table",tab:"overview",query:missionCategoryQuery};
const listeners=new Set<()=>void>();
const navigation:AdapterNavigation<F>={read:()=>locationState,change:next=>{locationState=next;listeners.forEach(fn=>fn());},subscribe:fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},capture:()=>{},restore:()=>{}};
const row=():ModuleRow<F>=>({id,name:data.name,code:data.code,status:data.status,category:data.category,level:data.level,plsValue:data.plsValue,path:paths.find(p=>p.id===data.pathProgramId)?.label??"—",description:data.description,guideline:data.guideline,supplementalUrl:data.supplementalUrl??null,paperSize:data.paperSize,prerequisite:data.prerequisiteCodeSnapshot,createdAt:"—",createdBy:"—",updatedAt:"—",updatedBy:"—"});
const list=async(_q:typeof missionCategoryQuery,signal:AbortSignal)=>{signal.throwIfAborted();return {rows:[row()],total:1,versions:{[id]:String(version)}};};
const detail=async(recordId:string,signal:AbortSignal)=>{signal.throwIfAborted();return recordId===id?{row:row(),version:String(version)}:null;};
const registry=new TddRegistry();
const schema=registry.register<F>({...missionIntegratedDefinition,data:{id:"pap2412-browser-test-only",list:async(q,c,s)=>{if(c!==context)throw Error("scope");return list(q,s);},detail:async(recordId,c,s)=>{if(c!==context)throw Error("scope");return (await detail(recordId,s))?.row??null;}}});
const adapter:AuthenticatedSurfaceAdapter<F>={registry,schema,scope:{surface:"HO"},userId:"PAP2412_TEST_ONLY",context,capabilities:{read:true,edit:scenario!=="readonly",create:false,delete:false,reveal:false,audit:false},list,detail,views:async()=>({unavailable:[]}),subject:recordId=>({type:"learning_mission",id:recordId}),history:async()=>({status:"unavailable",reason:"Synthetic only"}),dispose:()=>{}};
const boundary:MissionBoundary={preview:false,integratedMetadata:true,query:missionCategoryQuery,open:async signal=>{signal.throwIfAborted();return {adapter,navigation};},load:async(recordId,signal)=>{signal?.throwIfAborted();return recordId===id?{state:"ready",id,version,data:{...data}}:{state:"unavailable",message:"Unknown fixture"};},paths:async signal=>{signal?.throwIfAborted();return paths;},key:prefix=>prefix+(++serial),submit:async(command,signal)=>{signal?.throwIfAborted();if(!context.authorize("learning.mission.manage"))return {state:"denied",message:"Denied"};if(command.kind!=="update"||command.id!==id||command.expectedVersion!==version)return {state:"conflict",message:"Stale fixture"};writes++;if(scenario==="uncertain")return {state:"unverified",message:"Synthetic lost acknowledgement"};data={...command.data};version++;return {state:"verified",record:{id,version,code:data.code,status:data.status}};}};
Object.defineProperty(window,"__pap2412Fixture",{value:()=>({writes,version,data:{...data}})});
createRoot(document.getElementById("root")!).render(<TddPreferencePolicy.Provider value="ephemeral"><HoMissionsContent boundary={boundary}/></TddPreferencePolicy.Provider>);
