/** PAP-2031 / PNR-WISH — reveal presentation bound to a committed draw. */
import {parseWishReceipt,type WishDrawPayload} from "./pls-wish-tos-contract";
export type CommittedWish=ReturnType<typeof parseWishReceipt>;
export type WishRevealScope=Readonly<Pick<WishDrawPayload,"centerId"|"learnerId">&{eventId:string}>;
export function parseCommittedWishReveal(raw:unknown,receipt:CommittedWish):string|null{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Wish reveal không hợp lệ.");
 const r=raw as Record<string,unknown>;
 if(r.eventId!==receipt.eventId||r.policyRevisionId!==receipt.policyRevisionId||r.highestRarity!==receipt.highestRarity)throw Error("Wish reveal không khớp giao dịch.");
 if(r.mediaUrl===null)return null;
 if(typeof r.mediaUrl!=="string"||r.mediaUrl.length>2048||r.mediaUrl!==r.mediaUrl.trim())throw Error("Media Wish không hợp lệ.");
 const u=new URL(r.mediaUrl);
 if(u.origin!=="https://assets.pinohouse.art"||u.username||u.password||u.search||u.hash||u.href!==r.mediaUrl||!/^\/[A-Za-z0-9_/-]+\.(mp4|webm)$/i.test(u.pathname))throw Error("Media Wish không hợp lệ.");
 return r.mediaUrl;
}
