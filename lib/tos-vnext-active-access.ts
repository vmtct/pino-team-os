import type {TosVNextAppId} from "../app/components/tos-vnext/identity";
/** Home navigation only. Scheduling is context, not an app-access grant.
 * The TOS session gate and Core per-action/resource ACL remain authoritative. */
export function canOpenVNextApp(app:TosVNextAppId,options:{
 authenticated:boolean;centerReady:boolean;desktop:boolean;
}):boolean{
 if(!options.authenticated||!options.centerReady)return false;
 switch(app){
  case "shift":case "reception":case "shift-lead":case "classroom":case "training":return true;
  case "station":return options.desktop;
 }
 return false;
}
