/** PAP-2030 / PNR-WISH — exact catalog head binding, one record per canonical ID. */
import {parsePolicyHead,parseBannerHead,type WishConfigHead} from "@/lib/pls-wish-ho-contract";
export type Selection="published"|"pending";
export function selectWishRevision<T>(head:WishConfigHead<T>,preferred?:Selection):Selection{
 if(preferred==="pending"&&head.pendingDraft)return "pending";
 if(preferred==="published"&&head.published)return "published";
 if(head.pendingDraft)return "pending";
 if(head.published)return "published";
 throw Error("Không có phiên bản Wish.");
}
function list<T>(raw:unknown,parse:(v:unknown)=>WishConfigHead<T>){
 if(!Array.isArray(raw))throw Error("Danh mục Wish không hợp lệ.");
 const heads=raw.map(parse);
 if(new Set(heads.map(h=>h.recordId)).size!==heads.length)throw Error("Danh mục Wish có bản ghi trùng.");
 return heads;
}
export const parseWishPolicies=(raw:unknown)=>list(raw,parsePolicyHead);
export const parseWishBanners=(raw:unknown)=>list(raw,parseBannerHead);
