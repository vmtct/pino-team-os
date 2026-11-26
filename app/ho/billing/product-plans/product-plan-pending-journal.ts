// PAP-2365 / PLT-PRODUCT-PLAN. Minimal opaque pending fence; no commercial values.
export type CatalogPending=Readonly<{planId:string;expectedVersion:string}>;
export type CatalogJournal={read:()=>CatalogPending|null;begin:(value:CatalogPending)=>void;clear:(value:CatalogPending)=>void};
type StoragePort=Pick<Storage,"getItem"|"setItem"|"removeItem">;
const canonical=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function decode(raw:string|null):CatalogPending|null{
 if(raw===null)return null;
 const x:unknown=JSON.parse(raw);
 if(!x||typeof x!=="object"||Array.isArray(x)||Object.keys(x).length!==2||!("planId" in x)||!("expectedVersion" in x)||
 typeof x.planId!=="string"||!canonical.test(x.planId)||typeof x.expectedVersion!=="string"||!(/^[1-9][0-9]*$/).test(x.expectedVersion)||
 !Number.isSafeInteger(Number(x.expectedVersion)))throw Error("Invalid pending Product Plan fence");
 return {planId:x.planId,expectedVersion:x.expectedVersion};
}
const same=(a:CatalogPending|null,b:CatalogPending)=>a?.planId===b.planId&&a.expectedVersion===b.expectedVersion;
export function createCatalogJournal(storage:StoragePort,key:string):CatalogJournal{
 if(!key.trim())throw Error("Missing Product Plan journal scope");
 const read=()=>decode(storage.getItem(key));
 return {read,begin(value){if(read()!==null)throw Error("Pending Product Plan update");const raw=JSON.stringify(value);decode(raw);storage.setItem(key,raw);if(!same(read(),value))throw Error("Pending fence not persisted");},
 clear(value){if(!same(read(),value))throw Error("Pending fence changed");storage.removeItem(key);if(read()!==null)throw Error("Pending fence not cleared");}};
}
export function memoryCatalogJournal(){
 let raw:string|null=null;
 return createCatalogJournal({getItem:()=>raw,setItem:(_key,value)=>{raw=value;},removeItem:()=>{raw=null;}},"catalog");
}
