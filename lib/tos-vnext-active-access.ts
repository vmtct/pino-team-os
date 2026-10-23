import type {TosVNextAppId} from "../app/components/tos-vnext/identity";
import type {TosAppId} from "./tos-app-access";
/** One decision for enter + ongoing app access. Core server permissions still authoritative. */
export function canOpenVNextApp(app:TosVNextAppId,options:{
 authenticated:boolean;centerReady:boolean;scheduleReady:boolean;desktop:boolean;
 access:Pick<Record<TosAppId,boolean>,"reception"|"classroom"|"shift-lead">|null;
}):boolean{
 if(!options.authenticated||!options.centerReady||!options.scheduleReady)return false;
 switch(app){
  case "shift":case "training":return true;
  case "station":return options.desktop;
  case "reception":return Boolean(options.access?.reception);
  case "classroom":return Boolean(options.access?.classroom);
  case "shift-lead":return Boolean(options.access?.["shift-lead"]);
 }
}
