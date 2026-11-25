/** PAP-2337 / PNR-APP-HUB — synthetic navigation; no live route/ACL changes. */
import type {AdapterNavigation,AdapterLocation} from "@/lib/workspace-adapters/navigation";
import {draftQuery,type DraftFields} from "./native-draft-binding";
const key="pino:preview:post";
import {valid} from "./post-preview-query";
export {parsePostReviewQuery} from "./post-preview-query";
export function postPreviewNavigation():AdapterNavigation<DraftFields>{
 if(location.pathname!=="/bo/piner-posts")throw Error("Post preview route required");
 let focused:HTMLElement|null=null,recordId:string|undefined,scroll={x:0,y:0,left:0,top:0};
 return {
  read(){const id=new URLSearchParams(location.search).get("record");const owned=history.state?.[key] as AdapterLocation<DraftFields>|undefined;return {kind:valid(id)?owned?.recordId===id&&owned.kind==="drawer"?"drawer":"detail":"table",...(valid(id)?{recordId:id}:{}),tab:owned?.recordId===id?owned.tab:new URLSearchParams(location.search).get("tab")??"overview",query:owned?.query??draftQuery};},
  change(next,replace=false){if(next.kind!=="table"&&!valid(next.recordId))throw Error("Synthetic record required");const url=new URL(location.href);if(next.kind==="table"){url.searchParams.delete("record");url.searchParams.delete("tab");}else{url.searchParams.set("record",next.recordId!);if(next.kind==="detail"&&next.tab!=="overview")url.searchParams.set("tab",next.tab);else url.searchParams.delete("tab");}history[replace?"replaceState":"pushState"]({...history.state,[key]:next},"",url.pathname+url.search);window.dispatchEvent(new Event(key));},
  subscribe(listener){window.addEventListener("popstate",listener);window.addEventListener(key,listener);return()=>{window.removeEventListener("popstate",listener);window.removeEventListener(key,listener);};},
  capture(id){recordId=id;focused=document.activeElement instanceof HTMLElement?document.activeElement:null;const t=document.getElementById("table-scroll");scroll={x:window.scrollX,y:window.scrollY,left:t?.scrollLeft??0,top:t?.scrollTop??0};},
  restore(){requestAnimationFrame(()=>{window.scrollTo(scroll.x,scroll.y);const t=document.getElementById("table-scroll");if(t){t.scrollLeft=scroll.left;t.scrollTop=scroll.top;}const el=focused?.isConnected?focused:[...document.querySelectorAll<HTMLElement>("button[data-open]")].find(n=>n.dataset.open===recordId);el?.focus({preventScroll:true});});}
 };
}
