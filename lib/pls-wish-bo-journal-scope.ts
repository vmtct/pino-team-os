/** PAP-2032: actor and selected Center fence for a durable BO reversal. */
import type {BoWishDetail} from "./pls-wish-bo-contract";
import type {WishInvalidationJournal,WishInvalidationAttempt} from "./pls-wish-invalidation-journal";
export function scopedWishInvalidationJournal(journal:WishInvalidationJournal,centerId:string,verify:()=>Promise<void>):WishInvalidationJournal{
 const pin=(e:BoWishDetail,a?:WishInvalidationAttempt)=>{if(e.centerId!==centerId||(a&&(a.body.centerId!==centerId||a.body.eventId!==e.eventId)))throw Error("Center hoặc Wish Event đã thay đổi.");};
 return {
  async read(e){pin(e);await verify();return journal.read(e);},
  async reserve(e,a){pin(e,a);await verify();return journal.reserve(e,a);},
  async complete(e,a){pin(e,a);await verify();return journal.complete(e,a);}
 };
}
