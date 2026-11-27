// PAP-2418 · WFM-STAFF. Isolated local M1 fixture, never imported by live transport.
import {createPreviewState,reducePreview,readPreviewRecord,type PreviewState} from "@/lib/m1-preview/state";
import {staffPreviewCenter,staffPreviewSeed,type StaffPreviewRecord} from "./manual-create-preview";
import type {StaffCreateCommand} from "./manual-create-contract";
import {activationRequest,sameActivationRequest,type ActivationSubject,type ActivationRequest,type ActivationResult} from "./staff-activation-model";
import {fixturePerson} from "./staff-activation-baseline-preview";
type Fixture=StaffPreviewRecord&{activationRevision:number;existingPersonId?:string};
const feature={feature:"STAFF-ACTIVATE",jiraTask:"PAP-2418",surface:"HO",idPrefix:"STAFF-MOCK-",seed:{...staffPreviewSeed,status:"Ngưng",role:null,loginEmail:null,activationRevision:1} as Fixture,operations:["create","replace"]} as const;
export const newActivationPreview=(principal:string)=>createPreviewState<Fixture>(feature,"HO:"+principal);
export function fixtureSubject(state:PreviewState<Fixture>,id:string):ActivationSubject|null{
 const row=readPreviewRecord(state,id);
 if(!row||typeof row.name!=="string"||(row.status!=="Ngưng"&&row.status!=="Đang làm"))return null;
 return {id,name:row.name,status:row.status,revision:String(row.activationRevision),accountState:"missing",affiliation:row.center===staffPreviewCenter.label?{id:"affiliation:"+id,version:1,centerId:staffPreviewCenter.id,label:staffPreviewCenter.label,active:true}:null};
}
export function activateFixture(state:PreviewState<Fixture>,request:ActivationRequest):{state:PreviewState<Fixture>;result:ActivationResult}{
 const subject=fixtureSubject(state,request.staffId),row=readPreviewRecord(state,request.staffId);
 if(!subject||!row||!sameActivationRequest(activationRequest(subject),request))return {state,result:{kind:"stale"}};
 const next=reducePreview(state,{type:"replace",id:row.id,record:{...row,status:"Đang làm",activationRevision:row.activationRevision+1}});
 return {state:next,result:{kind:"activated",subject:fixtureSubject(next,row.id)!}};
}
export function createInactiveFixture(state:PreviewState<Fixture>,command:StaffCreateCommand):PreviewState<Fixture>{
 if(command.login||(command.existingPersonId!==undefined&&(command.existingPersonId!==fixturePerson.id||state.records.some(r=>r.existingPersonId===command.existingPersonId)))||command.centerId!==staffPreviewCenter.id||state.records.some(row=>row.phone===command.phone))throw Error("Invalid isolated staff fixture");
 return reducePreview(state,{type:"create",record:{fixture:true,name:command.name,phone:command.phone,email:command.email,gender:command.gender,birthDate:command.birthDate,center:staffPreviewCenter.label,status:"Ngưng",role:null,loginEmail:null,activationRevision:1,...(command.existingPersonId?{existingPersonId:command.existingPersonId}:{}),createdAt:null,createdBy:null,updatedAt:null,updatedBy:null}});
}
