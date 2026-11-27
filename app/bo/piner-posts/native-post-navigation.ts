/** PAP-2386: native canonical detail links retain tab, selected Center and browser history. */
import {browserTddNavigation,type AdapterLocation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {draftQuery,type DraftFields} from "./native-draft-binding";
import {nativePostId,nativePostTab,parseNativePostQuery} from "./native-post-query";
const key="pino:tdd:BO:piner-posts:native";
export function postNativeNavigation():AdapterNavigation<DraftFields>{
 const base=browserTddNavigation("BO","piner-posts",draftQuery);
 function readQuery(){const q=parseNativePostQuery(new URLSearchParams(location.search));if(!q)throw Error("Invalid native Post location");return q;}
 return {
  read(){
   const q=readQuery(),owned=history.state?.[key] as AdapterLocation<DraftFields>|undefined;
   return {kind:q.recordId?(q.tab?"detail":"drawer"):"table",...(q.recordId?{recordId:q.recordId}:{}),tab:q.tab??"overview",query:owned?.query??draftQuery};
  },
  change(state,replace=false){
   if(!["table","drawer","detail"].includes(state.kind)||state.kind!=="table"&&!nativePostId(state.recordId)||!nativePostTab(state.tab))throw Error("Invalid native Post state");
   const current=readQuery(),url=new URL(location.href);url.search="";
   if(current.centerId)url.searchParams.set("centerId",current.centerId);
   if(state.kind!=="table")url.searchParams.set("record",state.recordId!);
   if(state.kind==="detail")url.searchParams.set("tab",state.tab);
   history[replace?"replaceState":"pushState"]({...history.state,[key]:state},"",url.pathname+url.search);
   window.dispatchEvent(new Event(key));
  },
  subscribe(listener){window.addEventListener("popstate",listener);window.addEventListener(key,listener);return()=>{window.removeEventListener("popstate",listener);window.removeEventListener(key,listener);};},
  capture:base.capture,restore:base.restore
 };
}
