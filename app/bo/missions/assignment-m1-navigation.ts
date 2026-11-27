import type {AdapterLocation,AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {expandedAssignmentQuery,type ExpandedAssignmentFields} from "./assignment-expanded-schema";
import {ASSIGNMENT_M1_ID,ASSIGNMENT_M1_ROUTE} from "./assignment-m1-fixture";
type F=ExpandedAssignmentFields;
type LocalRouteState={kind:"table"|"drawer"|"detail";recordId?:string;tab:"overview"|"history"};
const KEY="pino:m1:bo:missions";
/** PAP-2347 exact shared fixture-specific route-state contract; no storage. */
export function assignmentLocalRoute(url:URL):LocalRouteState{
 if(url.origin!=="http://desktop-isrdren:8800"||url.username||url.password||url.pathname!==ASSIGNMENT_M1_ROUTE||url.hash||[...url.searchParams.keys()].some(k=>!["record","surface","tab"].includes(k))||["record","surface","tab"].some(k=>url.searchParams.getAll(k).length>1))throw Error("Local assignment route only");
 const record=url.searchParams.get("record"),surface=url.searchParams.get("surface"),tab=url.searchParams.get("tab");
 if(record!==null&&record!==ASSIGNMENT_M1_ID)throw Error("Unknown synthetic record");
 if(surface!==null&&(surface!=="detail"||record!==ASSIGNMENT_M1_ID))throw Error("Invalid local detail state");
 if(tab!==null&&(surface!=="detail"||!["overview","history"].includes(tab)))throw Error("Invalid local tab");
 return {kind:surface==="detail"?"detail":record?"drawer":"table",...(record?{recordId:record}:{}),tab:tab==="history"?"history":"overview"};
}
export function assignmentLocalRecord(url:URL):string|undefined{return assignmentLocalRoute(url).recordId;}
export function assignmentLocalStage(url:URL,owned?:AdapterLocation<F>):AdapterLocation<F>{
 const route=assignmentLocalRoute(url);
 const matches=owned?.kind===route.kind&&owned.recordId===route.recordId&&owned.tab===route.tab;
 return {...route,query:matches&&owned?.query?owned.query:expandedAssignmentQuery};
}
export function assignmentLocalHref(next:AdapterLocation<F>):string{
 if(!["table","drawer","detail"].includes(next.kind)||(next.kind!=="table"&&next.recordId!==ASSIGNMENT_M1_ID)||(next.kind==="table"&&next.recordId!==undefined)||(next.kind==="detail"?!["overview","history"].includes(next.tab):next.tab!=="overview"))throw Error("Invalid synthetic navigation");
 const q=new URLSearchParams();
 if(next.kind!=="table")q.set("record",ASSIGNMENT_M1_ID);
 if(next.kind==="detail"){q.set("surface","detail");if(next.tab==="history")q.set("tab","history");}
 return ASSIGNMENT_M1_ROUTE+(q.size?"?"+q.toString():"");
}
export function createAssignmentM1Navigation(record?:string):AdapterNavigation<F>{
 if(typeof window==="undefined"||self.origin!=="null"||assignmentLocalRecord(new URL(location.href))!==record)throw Error("Local assignment sandbox only");
 let state=assignmentLocalStage(new URL(location.href),history.state?.[KEY]);
 let focus:HTMLElement|null=null,selected:string|null=null;
 let scroll={x:0,y:0,left:0,top:0};
 const listeners=new Set<()=>void>();
 const sync=()=>{state=assignmentLocalStage(new URL(location.href),history.state?.[KEY]);listeners.forEach(fn=>fn());};
 return {read:()=>state,change:(next,replace=false)=>{
  assignmentLocalRoute(new URL(location.href));
  history[replace?"replaceState":"pushState"]({...history.state,[KEY]:next},"",assignmentLocalHref(next));
  sync();
 },subscribe:fn=>{if(listeners.size===0)window.addEventListener("popstate",sync);listeners.add(fn);return()=>{listeners.delete(fn);if(listeners.size===0)window.removeEventListener("popstate",sync);};},
 capture:id=>{selected=id;focus=document.activeElement instanceof HTMLElement?document.activeElement:null;const table=document.getElementById("table-scroll");scroll={x:window.scrollX,y:window.scrollY,left:table?.scrollLeft??0,top:table?.scrollTop??0};},
 restore:()=>{requestAnimationFrame(()=>{window.scrollTo(scroll.x,scroll.y);const table=document.getElementById("table-scroll");if(table){table.scrollLeft=scroll.left;table.scrollTop=scroll.top;}const target=focus?.isConnected?focus:[...document.querySelectorAll<HTMLElement>("button[data-open]")].find(node=>node.dataset.open===selected);target?.focus({preventScroll:true});});}};
}
