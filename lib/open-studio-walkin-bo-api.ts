/** PAP-1092: Open Studio walk-in BO client only. Not imported by HO Staff or legacy BO API. */
export type WalkinPath = "AC" | "LPP" | "LPA" | "PH";
export type WalkinPass = {
 id:string;code:string;status:"AVAILABLE"|"ASSIGNED"|"CONSUMED"|"REVOKED";
 path_code:WalkinPath|null;parent_user_id:string|null;center_id:string|null;
};
async function read<T>(resource:string):Promise<T>{
 const response=await fetch("/api/bo/open-studio/walkin/"+resource,{cache:"no-store"});
 const data:unknown=await response.json();
 if(!response.ok||!data||typeof data!=="object"||!("data" in data))
  throw new Error("Open Studio Pass inventory unavailable");
 return (data as {data:T}).data;
}
async function write<T>(resource:"batches"|"assign"|"revoke",payload:object):Promise<T>{
 const response=await fetch("/api/bo/open-studio/walkin/"+resource,{
  method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
  body:JSON.stringify(payload),cache:"no-store"
 });
 const data:unknown=await response.json();
 if(!response.ok||!data||typeof data!=="object"||!("data" in data))
  throw new Error("Open Studio Pass operation could not be completed");
 return (data as {data:T}).data;
}
export const walkinPassBoApi={
 inventory:(centerId?:string)=>read<WalkinPass[]>("inventory"+(centerId?"?centerId="+encodeURIComponent(centerId):"")),
 createBatch:(name:string,quantity:number)=>write<{id:string;name:string;quantity:number}>("batches",{name,quantity}),
 assign:(parentId:string,centerId:string,path:WalkinPath)=>write<WalkinPass>("assign",{parentId,centerId,path}),
 revoke:(passId:string)=>write<WalkinPass>("revoke",{passId})
};
