/** PAP-2425: isolated staging TDD navigation, bound to a server-admitted Center. */
import type {AdapterLocation,AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {expandedAssignmentQuery,type ExpandedAssignmentFields} from "./assignment-expanded-schema";
import {assignmentLocalHref} from "./assignment-m1-navigation";
import {parseAssignmentStageReview} from "./assignment-stage-admission";
import {ASSIGNMENT_M1_ROUTE} from "./assignment-m1-fixture";
import {assignmentUuid} from "@/lib/bo-mission-assignments";
type F=ExpandedAssignmentFields;
export function assignmentStageState(url:URL,centerId:string,owned?:AdapterLocation<F>):AdapterLocation<F>{
 const route=parseAssignmentStageReview(url);
 if(!route||route.centerId!==centerId)throw Error("Mission review scope changed");
 const id=route.recordId??undefined;
 const matches=owned?.kind===route.kind&&owned.recordId===id&&owned.tab===route.tab;
 return {kind:route.kind,...(id?{recordId:id}:{}),tab:route.tab,query:matches&&owned?.query?owned.query:expandedAssignmentQuery};
}
export function assignmentStageHref(centerId:string,next:AdapterLocation<F>){
 if(!assignmentUuid.test(centerId))throw Error("Invalid review Center");
 const url=new URL(assignmentLocalHref(next),"https://bo.staging.pinohouse.art");
 url.searchParams.set("centerId",centerId);
 return ASSIGNMENT_M1_ROUTE+"?"+url.searchParams.toString();
}
export function createAssignmentStageNavigation(centerId:string,onInvalid:()=>void):AdapterNavigation<F>{
 if(typeof window==="undefined")throw Error("Browser required");
 const key="pino:m1:bo:missions:staging:"+centerId;
 let state=assignmentStageState(new URL(location.href),centerId,history.state?.[key]);
 let focused:HTMLElement|null=null,selected:string|null=null;
 let scroll={x:0,y:0,left:0,top:0};
 const listeners=new Set<()=>void>();
 const sync=()=>{
  try{state=assignmentStageState(new URL(location.href),centerId,history.state?.[key]);}
  catch{onInvalid();return;}
  listeners.forEach(fn=>fn());
 };
 return {read:()=>state,change:(next,replace=false)=>{
  assignmentStageState(new URL(location.href),centerId);
  history[replace?"replaceState":"pushState"]({...history.state,[key]:next},"",assignmentStageHref(centerId,next));sync();
 },subscribe:fn=>{if(!listeners.size)window.addEventListener("popstate",sync);listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size)window.removeEventListener("popstate",sync);};},
 capture:id=>{selected=id;focused=document.activeElement instanceof HTMLElement?document.activeElement:null;const table=document.getElementById("table-scroll");scroll={x:window.scrollX,y:window.scrollY,left:table?.scrollLeft??0,top:table?.scrollTop??0};},
 restore:()=>{requestAnimationFrame(()=>{window.scrollTo(scroll.x,scroll.y);const table=document.getElementById("table-scroll");if(table){table.scrollLeft=scroll.left;table.scrollTop=scroll.top;}const target=focused?.isConnected?focused:[...document.querySelectorAll<HTMLElement>("button[data-open]")].find(node=>node.dataset.open===selected);target?.focus({preventScroll:true});});}};
}
