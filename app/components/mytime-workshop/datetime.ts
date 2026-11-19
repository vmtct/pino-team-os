// PAP-2199: opt-in Workshop bridge; shared PINO display continues to require RFC3339.
import type {BoField,BoValue} from "@/lib/bo-registration";
import {formatPinoDateTime} from "@/lib/pino-datetime";
export function workshopEditorValue(field:BoField,value:BoValue):BoValue{
 if(field.type!=="datetime"||!["startAt","endAt"].includes(field.key))return undefined;
 if(typeof value!=="string"||formatPinoDateTime(value)==="—")return "";
 // This is the same +07:00 wall-clock contract used by ictWorkshopInstant.
 return new Date(Date.parse(value)+7*3600000).toISOString().slice(0,-1);
}
