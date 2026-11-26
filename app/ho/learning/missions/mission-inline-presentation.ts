/** PAP-2412 / HO-MISSION-CRUD — exact Mission presentation selection, not a write or authorization boundary. */
import {missionInlineFields,missionInlineTableFields} from "./schema";
import {isMissionCategory} from "./mission-category";
import {normalizeMissionSupplementalUrl} from "./mission-supplemental-url";
export const MISSION_METADATA_COMMAND=Object.freeze({
 surface:"HO",moduleKey:"missions",command:"missions.metadata",permission:"learning.mission.manage",
 fields:Object.freeze([...missionInlineFields]),
} as const);
type MissionField=typeof missionInlineFields[number];
export type MissionHost="table"|"drawer"|"detail";
type Definition={
 surface:string;key:string;
 capabilities:{read:string;edit?:string};
 fields:readonly {key:string;type:string;permission:string;readOnly:boolean;capabilities:{display:boolean;inlineEdit:boolean}}[];
 table:{inlineEdit:{enabled:boolean;fields:readonly string[]}};
};
type Context={surface:string;authorize:(permission:string)=>boolean};
export type MissionMetadataPresentation=Readonly<{
 command:typeof MISSION_METADATA_COMMAND;
 render:(input:{host:MissionHost;row:Readonly<Record<string,unknown>>;version:string;field:MissionField;anchor:HTMLElement;onClose:()=>void;onSaved:()=>void})=>import("react").ReactNode;
}>;
const fieldTypes:Readonly<Record<MissionField,string>>={name:"text",code:"text",category:"select",level:"number",plsValue:"number",path:"select",description:"textarea",guideline:"textarea",supplementalUrl:"url"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function isField(field:string):field is MissionField{return missionInlineFields.some(f=>f===field);}
function validValue(field:MissionField,value:unknown):boolean{
 switch(field){
  case "name":return typeof value==="string"&&!!value.trim()&&value.length<=160;
  case "code":return typeof value==="string"&&/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(value);
  case "category":return value===null||isMissionCategory(value);
  case "level":return typeof value==="number"&&Number.isInteger(value)&&value>=1&&value<=5;
  case "plsValue":return typeof value==="number"&&Number.isSafeInteger(value)&&value>=0;
  case "path":return typeof value==="string"&&["Artchitect","PianoHouse","Little Piner Art","Little Piner Piano"].includes(value);
  case "description":return value===null||(typeof value==="string"&&value.length<=4000);
  case "guideline":return value===null||(typeof value==="string"&&value.length<=8000);
  case "supplementalUrl":{const url=normalizeMissionSupplementalUrl(value);return url.ok&&url.value===value;}
 }
}
export function missionPresentationSelection(schema:Definition,context:Context,presentation:MissionMetadataPresentation|undefined,host:MissionHost,row:Readonly<Record<string,unknown>>,version:string|undefined,field:string,hasGenericWrites:boolean){
 if(!presentation||presentation.command!==MISSION_METADATA_COMMAND||hasGenericWrites||
    schema.surface!=="HO"||schema.key!=="missions"||context.surface!=="HO"||
    schema.capabilities.read!=="catalog.learning.view"||schema.capabilities.edit!=="learning.mission.manage"||
    schema.table.inlineEdit.enabled||schema.table.inlineEdit.fields.length||schema.fields.some(f=>f.capabilities.inlineEdit)||
    new Set(schema.fields.map(f=>f.key)).size!==schema.fields.length||
    !context.authorize("catalog.learning.view")||!context.authorize("learning.mission.manage")||
    !["table","drawer","detail"].includes(host)||!isField(field)||
    (host==="table"&&!missionInlineTableFields.some(f=>f===field))||
    typeof row.id!=="string"||!uuid.test(row.id)||row.status!=="ACTIVE"||
    typeof version!=="string"||!/^[1-9][0-9]*$/.test(version)||!Number.isSafeInteger(Number(version)))return null;
 const metadata=schema.fields.find(f=>f.key===field);
 if(!metadata||metadata.type!==fieldTypes[field]||metadata.permission!=="catalog.learning.view"||
    !metadata.readOnly||!metadata.capabilities.display||!Object.hasOwn(row,field)||!validValue(field,row[field]))return null;
 return Object.freeze({id:row.id,expectedVersion:version,field});
}
