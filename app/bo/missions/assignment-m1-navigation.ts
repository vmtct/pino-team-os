import type {AdapterLocation,AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {expandedAssignmentQuery,type ExpandedAssignmentFields} from "./assignment-expanded-schema";
import {ASSIGNMENT_M1_ID,ASSIGNMENT_M1_ROUTE} from "./assignment-m1-fixture";
type F=ExpandedAssignmentFields;
const KEY="pino:m1:bo:missions";
export function assignmentLocalRecord(url:URL):string|undefined{
 if(url.origin!=="http://desktop-isrdren:8800"||url.pathname!==ASSIGNMENT_M1_ROUTE||url.hash||[...url.searchParams.keys()].some(k=>k!=="record")||url.searchParams.getAll("record").length>1)throw Error("Local assignment route only");
 const record=url.searchParams.get("record");
 if(record!==null&&record!==ASSIGNMENT_M1_ID)throw Error("Unknown synthetic record");
 return record??undefined;
}
export function assignmentLocalStage(record:string|undefined,owned:AdapterLocation<F>|undefined):AdapterLocation<F>{
 const matches=owned?.recordId===record;
 const kind=record?(matches&&owned?.kind==="detail"?"detail":"drawer"):"table";
 return {kind,...(record?{recordId:record}:{}),tab:kind==="detail"&&matches&&owned?.tab==="history"?"history":"overview",query:matches&&owned?.query?owned.query:expandedAssignmentQuery};
}
export function createAssignmentM1Navigation(record?:string):AdapterNavigation<F>{
 if(typeof window==="undefined"||self.origin!=="null"||assignmentLocalRecord(new URL(location.href))!==record)throw Error("Local assignment sandbox only");
 let state=assignmentLocalStage(record,history.state?.[KEY]);
 let focus:HTMLElement|null=null,selected:string|null=null;
 let scroll={x:0,y:0,left:0,top:0};
 const listeners=new Set<()=>void>();
 const sync=()=>{state=assignmentLocalStage(assignmentLocalRecord(new URL(location.href)),history.state?.[KEY]);listeners.forEach(fn=>fn());};
 return {read:()=>state,change:(next,replace=false)=>{
  if(!["table","drawer","detail"].includes(next.kind)||(next.kind!=="table"&&next.recordId!==ASSIGNMENT_M1_ID)||(next.kind==="table"&&next.recordId!==undefined))throw Error("Unknown synthetic record");
  const url=new URL(location.href);assignmentLocalRecord(url);
  if(next.kind==="table")url.searchParams.delete("record");else url.searchParams.set("record",ASSIGNMENT_M1_ID);
  history[replace?"replaceState":"pushState"]({...history.state,[KEY]:next},"",url.pathname+url.search);
  sync();
 },subscribe:fn=>{if(listeners.size===0)window.addEventListener("popstate",sync);listeners.add(fn);return()=>{listeners.delete(fn);if(listeners.size===0)window.removeEventListener("popstate",sync);};},
 capture:id=>{selected=id;focus=document.activeElement instanceof HTMLElement?document.activeElement:null;const table=document.getElementById("table-scroll");scroll={x:window.scrollX,y:window.scrollY,left:table?.scrollLeft??0,top:table?.scrollTop??0};},
 restore:()=>{requestAnimationFrame(()=>{window.scrollTo(scroll.x,scroll.y);const table=document.getElementById("table-scroll");if(table){table.scrollLeft=scroll.left;table.scrollTop=scroll.top;}const target=focus?.isConnected?focus:[...document.querySelectorAll<HTMLElement>("button[data-open]")].find(node=>node.dataset.open===selected);target?.focus({preventScroll:true});});}};
}
