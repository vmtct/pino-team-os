/** PAP-2181: native read-only BO provider. Every list/detail uses the existing Center BFF. */
import type {SurfaceProvider,SurfaceScope} from "@/lib/workspace-adapters";
import {BoApiError} from "@/lib/bo-api-error";
import {readEnrollmentRows,type EnrollmentRelations} from "./enrollment-read-client";
import type {EnrollmentFields} from "./schema";

const center=(scope:SurfaceScope)=>{
 if(scope.surface!=="BO")throw new BoApiError(403,"Không thể đọc lịch học ngoài BO.",null);
 return scope.centerId;
};

export function enrollmentProvider(){
 const relations=new Map<string,EnrollmentRelations>();
 const provider:SurfaceProvider<EnrollmentFields>={
  pagination:"local-ui",
  list:async(_query,scope,fetcher,signal)=>{
   const centerId=center(scope);
   const rows=await readEnrollmentRows(fetcher,centerId,signal);
   signal.throwIfAborted();
   relations.clear();
   for(const entry of rows)relations.set(entry.row.id,entry.relations);
   return {records:rows.map(entry=>({row:entry.row,centerId})),total:rows.length};
  },
  detail:async(id,scope,fetcher,signal)=>{
   const centerId=center(scope);
   const rows=await readEnrollmentRows(fetcher,centerId,signal);
   signal.throwIfAborted();
   const entry=rows.find(item=>item.row.id===id);
   if(!entry){relations.delete(id);return null;}
   relations.set(id,entry.relations);
   return {row:entry.row,centerId};
  }
 };
 return {provider,relation:(id:string)=>relations.get(id),dispose:()=>relations.clear()};
}
