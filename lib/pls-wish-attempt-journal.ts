/** PAP-2031 / PNR-WISH — local durable command identity, not a server authorization boundary. */
import {createWishAttempt,type WishAttempt,type WishDrawPayload} from "./pls-wish-tos-contract";
export type WishScope=Pick<WishDrawPayload,"centerId"|"learnerId">;
export type WishAttemptJournal={read:(scope:WishScope)=>Promise<WishAttempt|null>;reserve:(attempt:WishAttempt)=>Promise<void>;complete:(attempt:WishAttempt)=>Promise<void>};
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function valid(a:unknown):WishAttempt{
 if(!a||typeof a!=="object")throw Error("Invalid Wish journal");
 const {key,payload:p}=a as WishAttempt;
 if(typeof key!=="string"||!p||![p.centerId,p.learnerId,p.policyRevisionId,p.bannerRevisionId].every(x=>typeof x==="string"&&id.test(x))||!Number.isSafeInteger(p.count)||p.count<1||p.count>10||!Number.isSafeInteger(p.expectedCost)||p.expectedCost<1||p.expectedCost>1000000)throw Error("Invalid Wish journal");
 return createWishAttempt({centerId:p.centerId,learnerId:p.learnerId,policyRevisionId:p.policyRevisionId,bannerRevisionId:p.bannerRevisionId,count:p.count,expectedCost:p.expectedCost},key);
}
const equivalent=(a:WishAttempt,b:WishAttempt)=>a.key===b.key&&a.payload.centerId===b.payload.centerId&&a.payload.learnerId===b.payload.learnerId&&a.payload.policyRevisionId===b.payload.policyRevisionId&&a.payload.bannerRevisionId===b.payload.bannerRevisionId&&a.payload.count===b.payload.count&&a.payload.expectedCost===b.payload.expectedCost;
/** Actor must be the current verified principal; only attempt identifiers are stored. One pending attempt per actor on this browser origin. */
export function indexedWishJournal(actorId:string,factory:IDBFactory=indexedDB):WishAttemptJournal{
 if(!id.test(actorId))throw Error("Invalid Wish principal");
 const transaction=wishJournalTransaction(factory);
 return {
  read:scope=>transaction<WishAttempt|null>("readonly",(s,finish,fail)=>{const r=s.get(actorId);r.onsuccess=()=>{try{if(r.result===undefined){finish(null);return;}const a=valid(r.result);if(a.payload.centerId!==scope.centerId||a.payload.learnerId!==scope.learnerId)throw Error("Có Wish chưa đối soát tại học viên hoặc Center khác.");finish(a);}catch(e){fail(e);}};}),
  reserve:attempt=>transaction<void>("readwrite",(s,finish,fail)=>{const a=valid(attempt),r=s.get(actorId);r.onsuccess=()=>{try{if(r.result!==undefined){if(!equivalent(valid(r.result),a))throw Error("Đã có giao dịch Wish đang chờ.");finish(undefined);return;}s.add(a,actorId);finish(undefined);}catch(e){fail(e);}};}),
  complete:attempt=>transaction<void>("readwrite",(s,finish,fail)=>{const a=valid(attempt),r=s.get(actorId);r.onsuccess=()=>{try{if(r.result===undefined||!equivalent(valid(r.result),a))throw Error("Giao dịch Wish đã thay đổi.");s.delete(actorId);finish(undefined);}catch(e){fail(e);}};})
 };
}
/** Same origin, strict-durability transaction primitive for the Wish feature. */
export function wishJournalTransaction(factory:IDBFactory){
 const db=()=>new Promise<IDBDatabase>((resolve,reject)=>{
  const req=factory.open("pino-wish-attempt-v1",1);
  req.onupgradeneeded=()=>req.result.createObjectStore("attempts");
  req.onerror=()=>reject(req.error??Error("Wish journal unavailable"));
  req.onblocked=()=>reject(Error("Wish journal blocked"));
  req.onsuccess=()=>resolve(req.result);
 });
 async function transaction<T>(mode:IDBTransactionMode,visit:(store:IDBObjectStore,finish:(value:T)=>void,fail:(error:unknown)=>void)=>void):Promise<T>{
  const opened=await db();
  try{return await new Promise<T>((resolve,reject)=>{
   const tx=opened.transaction("attempts",mode,{durability:"strict"});let value:T,ready=false;
   const fail=(e:unknown)=>{try{tx.abort();}catch{/* terminal */}reject(e);};
   tx.onabort=()=>reject(tx.error??Error("Wish journal aborted"));
   tx.onerror=()=>reject(tx.error??Error("Wish journal failed"));
   tx.oncomplete=()=>{if(ready)resolve(value);else reject(Error("Wish journal result missing"));};
   try{visit(tx.objectStore("attempts"),v=>{value=v;ready=true;},fail);}catch(e){fail(e);}
  });}finally{opened.close();}
 }
 return transaction;
}
