/** PAP-2387 / SCH-PARENTS-GUARDIANS — synthetic presentation only, never Core IDs. */
import {createPreviewState,readPreviewRecord,reducePreview} from "@/lib/m1-preview/state";
import type {PreviewFeature,PreviewRecord} from "@/lib/m1-preview/contract";
import type {NativeParentRow} from "./parent-native-data";
import {inferParentContactType,type BoParentStandaloneCreateInput,type BoParentStandaloneCreateResult} from "@/lib/bo-parent-create-client";
export const PARENT_MOCK_CENTER="PARENT-MOCK-CENTER";
export const PARENT_MOCK_SEED="PARENT-MOCK-001";
export const parentMockId=(id:string)=>/^PARENT-MOCK-[0-9]{3,}$/.test(id);
type Row=PreviewRecord & {name:string;maskedContact:string;studentCount:number;centerNames:string[];version:number;attention:null};
const seed:Row={id:PARENT_MOCK_SEED,fixture:true,name:"Nguyễn Phụ Huynh Mẫu",maskedContact:"09•••••123",studentCount:1,centerNames:["Cần Thơ · Mẫu"],version:1,attention:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
const definition:PreviewFeature<Row>={feature:"PARENT-DIRECTORY",jiraTask:"PAP-2387",surface:"BO",idPrefix:"PARENT-MOCK-",seed,operations:["create","replace"]};
const project=(r:Row):NativeParentRow=>({...r,centers:r.centerNames.join(", ")});
export function createParentFixture(){
 let state=createPreviewState(definition,PARENT_MOCK_CENTER);
 const receipts=new Map<string,{fingerprint:string;result:BoParentStandaloneCreateResult}>();
 const requireCenter=(centerId:string)=>{if(centerId!==PARENT_MOCK_CENTER)throw Error("Synthetic Center required");};
 const requireRow=(id:string)=>{if(!parentMockId(id))throw Error("Synthetic Parent required");const r=readPreviewRecord(state,id);if(!r)throw Error("Unknown synthetic Parent");return r;};
 return {
  list(centerId:string){requireCenter(centerId);return state.records.map(r=>project(structuredClone(r)));},
  detail(centerId:string,id:string){requireCenter(centerId);const r=requireRow(id);return {id:r.id,students:r.studentCount?[{id:"STUDENT-MOCK-001",name:"Học viên mẫu",relationship:"Phụ huynh",linkedAt:"—"}]:[],contacts:[{id:r.id+"-CONTACT",type:r.maskedContact.includes("@")?"EMAIL" as const:"PHONE" as const,maskedValue:r.maskedContact,primary:true,verified:false}],audit:[],auditAuthorized:true};},
  rename(centerId:string,id:string,value:string,version:number){requireCenter(centerId);const r=requireRow(id),name=value.trim();if(!name||name.length>160||version!==r.version)throw Error("Invalid synthetic edit");const updated:Row={...r,name,version:r.version+1};state=reducePreview(state,{type:"replace",id,record:updated});return project(updated);},
  create(centerId:string,body:BoParentStandaloneCreateInput,key:string){requireCenter(centerId);const name=body.displayName.trim(),contact=body.contacts[0],value=contact?.value.trim()??"";if(!key.trim()||!name||name.length>120||body.contacts.length!==1||!contact?.isPrimary||inferParentContactType(value)!==contact.identifierType)throw Error("Invalid synthetic create");const fingerprint=JSON.stringify({name,value,type:contact.identifierType}),old=receipts.get(key);if(old){if(old.fingerprint!==fingerprint)throw Error("Synthetic request conflict");return structuredClone(old.result);}const maskedContact=contact.identifierType==="EMAIL"?"•••@example.invalid":"••••••"+value.slice(-3);state=reducePreview(state,{type:"create",record:{fixture:true,name,maskedContact,studentCount:0,centerNames:[...seed.centerNames],version:1,attention:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null}});const id=state.records.at(-1)!.id;const result:BoParentStandaloneCreateResult={parentUserId:id,version:1,createdContactIdentifierIds:[id+"-CONTACT"],directoryVisibility:"CENTER_VISIBLE"};receipts.set(key,{fingerprint,result});return structuredClone(result);},
 };
}
