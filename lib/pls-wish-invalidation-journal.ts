/** PAP-2032 / PNR-WISH — exact actor/event pending reversal, same transactional store as draw. */
import {wishJournalTransaction} from "./pls-wish-attempt-journal";
import {prepareWishInvalidation,type BoWishDetail} from "./pls-wish-bo-contract";
export type WishInvalidationAttempt=ReturnType<typeof prepareWishInvalidation>;
export type WishInvalidationJournal={read:(event:BoWishDetail)=>Promise<WishInvalidationAttempt|null>;reserve:(event:BoWishDetail,attempt:WishInvalidationAttempt)=>Promise<void>;complete:(event:BoWishDetail,attempt:WishInvalidationAttempt)=>Promise<void>};
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function exact(event:BoWishDetail,raw:unknown){
 if(!raw||typeof raw!=="object")throw Error("Invalid reversal journal");
 const a=raw as WishInvalidationAttempt;
 const expected=prepareWishInvalidation({...event,status:"COMMITTED"},a.body.reason,a.key);
 if(JSON.stringify(a)!==JSON.stringify(expected))throw Error("Có Invalidate chưa đối soát hoặc dữ liệu gốc đã thay đổi.");
 return expected;
}
export function indexedWishInvalidationJournal(actorId:string,factory:IDBFactory=indexedDB):WishInvalidationJournal{
 if(!id.test(actorId))throw Error("Invalid Wish principal");
 const key="reverse:"+actorId, transaction=wishJournalTransaction(factory);
 return {
 read:event=>transaction<WishInvalidationAttempt|null>("readonly",(s,finish,fail)=>{const r=s.get(key);r.onsuccess=()=>{try{finish(r.result===undefined?null:exact(event,r.result));}catch(e){fail(e);}};}),
 reserve:(event,attempt)=>transaction<void>("readwrite",(s,finish,fail)=>{const a=exact(event,attempt),r=s.get(key);r.onsuccess=()=>{try{if(r.result!==undefined){if(JSON.stringify(exact(event,r.result))!==JSON.stringify(a))throw Error("Đã có Invalidate đang chờ.");finish(undefined);return;}s.add(a,key);finish(undefined);}catch(e){fail(e);}};}),
 complete:(event,attempt)=>transaction<void>("readwrite",(s,finish,fail)=>{const a=exact(event,attempt),r=s.get(key);r.onsuccess=()=>{try{if(r.result===undefined||JSON.stringify(exact(event,r.result))!==JSON.stringify(a))throw Error("Invalidate đã thay đổi.");s.delete(key);finish(undefined);}catch(e){fail(e);}};})
 };
}
