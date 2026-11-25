/** PAP-2337 / PNR-APP-HUB — isolated presentation contract, no transport. */
export type PostStatus = "Nháp" | "Chờ duyệt" | "Đã đăng" | "Đã ẩn";
export type PostMedia = {id:string;sourceDiary:string;src:string;retouched:boolean};
export type PostPreview = {id:string;person:string;center:string;program:string;caption:string;status:PostStatus;diaries:string[];media:PostMedia[];history:string[];fixture:true;createdAt:null;createdBy:null;updatedAt:null;updatedBy:null};
export const completePost=(post:PostPreview)=>Boolean(post.person&&post.center&&post.program&&post.caption.trim()&&post.diaries.length&&post.media.length);
export function transitionPost(post:PostPreview,surface:"bo"|"ho",next:PostStatus,reason=""):PostPreview {
 const valid=surface==="bo"?post.status==="Nháp"&&next==="Chờ duyệt" : (post.status==="Chờ duyệt"&&(next==="Nháp"||next==="Đã đăng"))||(post.status==="Đã đăng"&&next==="Đã ẩn")||(post.status==="Đã ẩn"&&next==="Đã đăng");
 if(!valid || (next==="Đã đăng"||next==="Chờ duyệt")&&!completePost(post) || next==="Nháp"&&!reason.trim())throw Error("Thao tác không hợp lệ");
 return {...post,status:next,history:[...post.history,post.status+" → "+next+(reason?": "+reason:"")]};
}
