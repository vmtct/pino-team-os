/** PAP-2031 actor-pinned, same-origin Wish host. Server authenticates the same credential before dispatch. */
import {indexedWishJournal,type WishAttemptJournal,type WishScope} from "./pls-wish-attempt-journal";
import {wishAttemptRequest,type WishAttempt} from "./pls-wish-tos-contract";
import type {WishRevealScope} from "./pls-wish-reveal-contract";
const root="/api/tos-learning/pinoria/pls-wish/";
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Fetcher=typeof fetch;
async function read(fetcher:Fetcher,path:string,init:RequestInit={},actor?:string){
 const headers=new Headers(init.headers);if(actor)headers.set("x-pino-expected-actor",actor);
 const r=await fetcher(root+path,{...init,headers,credentials:"same-origin",cache:"no-store",signal:AbortSignal.any([AbortSignal.timeout(15000),...(init.signal?[init.signal]:[])])});
 if(!r.ok)throw Error(r.status===401||r.status===403?"Phiên đăng nhập hoặc quyền Wish đã thay đổi.":r.status===409?"Dữ liệu Wish đã thay đổi.":"Chưa xác minh được kết quả Wish.");
 const raw:unknown=await r.json();if(!raw||typeof raw!=="object"||!("data" in raw))throw Error("Thiếu dữ liệu Wish.");
 return raw.data;
}
export async function readWishActor(signal:AbortSignal,fetcher:Fetcher=fetch){
 const r=await read(fetcher,"session",{signal});signal.throwIfAborted();
 if(!r||typeof r!=="object"||!("actorId" in r)||typeof r.actorId!=="string"||!id.test(r.actorId))throw Error("Không xác minh được phiên Wish.");
 return r.actorId;
}
export function createTosWishHost(actor:string,scope:WishScope,journal:WishAttemptJournal,fetcher:Fetcher=fetch){
 if(![actor,scope.centerId,scope.learnerId].every(x=>id.test(x)))throw Error("Phạm vi Wish không hợp lệ.");
 const pin=(s:WishScope)=>{if(s.centerId!==scope.centerId||s.learnerId!==scope.learnerId)throw Error("Học viên hoặc Center đã thay đổi.");};
 const verify=async()=>{if(await readWishActor(AbortSignal.timeout(15000),fetcher)!==actor)throw Error("Phiên Wish đã thay đổi.");};
 return {
  journal:{async read(s:WishScope){pin(s);await verify();return journal.read(s);},async reserve(a:WishAttempt){pin(a.payload);await verify();return journal.reserve(a);},async complete(a:WishAttempt){pin(a.payload);await verify();return journal.complete(a);}},
  async quote(s:WishScope,signal:AbortSignal){pin(s);return read(fetcher,"quote?"+new URLSearchParams({centerId:s.centerId,learnerId:s.learnerId}),{signal},actor);},
  async draw(a:WishAttempt){pin(a.payload);await verify();const persisted=await journal.read(scope);if(!persisted||persisted.key!==a.key||JSON.stringify(persisted.payload)!==JSON.stringify(a.payload))throw Error("Giao dịch chưa được giữ chỗ.");return read(fetcher,"draw",wishAttemptRequest(a),actor);},
  async reveal(s:WishRevealScope,signal:AbortSignal){pin(s);if(!id.test(s.eventId))throw Error("Giao dịch Wish không hợp lệ.");return read(fetcher,"reveal?"+new URLSearchParams({centerId:s.centerId,learnerId:s.learnerId,eventId:s.eventId}),{signal},actor);}
 };
}
export function browserTosWishHost(actor:string,scope:WishScope){return createTosWishHost(actor,scope,indexedWishJournal(actor));}
