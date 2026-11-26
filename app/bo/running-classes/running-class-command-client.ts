/** PLT-DELIVERY / PAP-1037 / PAP-1043 / PAP-2225 — unmounted native command transport. */
import type {ClassCreate} from "./running-class-draft";
import {CLASS_EDIT_KEYS,type ClassEditCommand,type ClassRecord} from "./running-class-presentation";
import {scopedClassesFetcher} from "../components/registration/BoScopedClassRead";
import {BoApiError} from "@/lib/bo-api-error";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const createKeys=[...CLASS_EDIT_KEYS,"centerId","deliveryTopology"] as const;
const base="/api/bo/delivery/running-classes";
const invalid=(message:string):never=>{throw Error(message);};
function canonical(id:string){if(!uuid.test(id))invalid("Invalid canonical Running Class scope.");return id;}
function exact(input:object,keys:readonly string[]){if(Object.keys(input).some(k=>!keys.includes(k)))invalid("Unexpected Running Class command field.");}
function match(row:ClassRecord,expected:Record<string,unknown>){
 return Object.entries(expected).every(([key,value])=>Object.is(row[key as keyof ClassRecord],value));
}
function receipt(row:unknown,expected:Record<string,unknown>):ClassRecord{
 if(!row||typeof row!=="object")return invalid("Missing Running Class receipt.");
 const r=row as ClassRecord;
 canonical(r.id);
 if(!match(r,expected))return invalid("Running Class receipt mismatch.");
 return r;
}
async function payload(response:Response,status:number):Promise<unknown>{
 let body:{data?:unknown;error?:{message?:string;requestId?:string}};
 try{body=await response.json() as typeof body;}catch{throw new BoApiError(response.status,"Invalid Running Class response.",response.headers.get("x-request-id"),false);}
 if(response.status!==status||body.data===undefined)throw new BoApiError(response.status,body.error?.message??"Running Class command not confirmed.",response.headers.get("x-request-id")??body.error?.requestId??null);
 return body.data;
}
export type PreparedClassCreate=Readonly<{centerId:string;key:string;body:string}>;
export function prepareClassCreate(centerId:string,command:ClassCreate,key:string):PreparedClassCreate{
 canonical(centerId);canonical(command.pathProgramId);canonical(command.learningSpaceId);
 exact(command,createKeys);
 if(command.centerId!==centerId||command.status!=="INACTIVE"||!key.trim()||key!==key.trim())return invalid("Invalid Running Class create intent.");
 return Object.freeze({centerId,key,body:JSON.stringify(command)});
}
export function createRunningClassCommandClient(centerId:string,fetcher:typeof fetch){
 canonical(centerId);
 const query="?centerId="+encodeURIComponent(centerId);
 async function readback(expected:ClassRecord){
  const response=await scopedClassesFetcher(fetcher,centerId)("/api/bo/delivery/bootstrap-state",{method:"GET",cache:"no-store"});
  const data=await payload(response,200) as {runningClasses:unknown[]};
  const rows=data.runningClasses.filter(r=>r&&typeof r==="object"&&(r as ClassRecord).id===expected.id);
  if(rows.length!==1)return invalid("Running Class readback missing or ambiguous.");
  const fields=Object.fromEntries(["id","version",...createKeys].map(k=>[k,expected[k as keyof ClassRecord]]));
  return receipt(rows[0],fields);
 }
 return {
  async create(attempt:PreparedClassCreate){
   if(attempt.centerId!==centerId)return invalid("Running Class attempt belongs to another Center.");
   const command=JSON.parse(attempt.body) as ClassCreate;
   prepareClassCreate(centerId,command,attempt.key);
   const result=await payload(await fetcher(base+"/create-inactive"+query,{method:"POST",headers:{"content-type":"application/json","idempotency-key":attempt.key},body:attempt.body}),201);
   return readback(receipt(result,{...command,version:1}));
  },
  async edit(original:ClassRecord,command:ClassEditCommand){
   canonical(original.id);
   if(original.centerId!==centerId||command.id!==original.id||command.expectedVersion!==original.version||!Number.isSafeInteger(original.version)||original.version<1)return invalid("Stale Running Class intent.");
   exact(command.changes,CLASS_EDIT_KEYS);
   if(!Object.keys(command.changes).length||Object.values(command.changes).some(v=>v===undefined))return invalid("Empty Running Class edit.");
   if(command.changes.pathProgramId!==undefined)canonical(command.changes.pathProgramId);
   if(command.changes.learningSpaceId!==undefined)canonical(command.changes.learningSpaceId);
   const expected={...original,...command.changes,version:original.version+1};
   const result=await payload(await fetcher(base+"/"+original.id+"/inline"+query,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:command.expectedVersion,...command.changes})}),200);
   return readback(receipt(result,expected));
  }
 };
}
