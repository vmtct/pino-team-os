/** Feature-scoped display of the recorded-account fact; never infer a legal name or role. */
export const recordedReviewAccountLabel="Tài khoản duyệt (chưa xác minh tên)";
export function validRecordedReviewAccount(marker:unknown,kind:unknown,legalName:unknown):boolean {
 return marker===undefined||(marker===true&&kind==="REVIEW"&&legalName===null);
}
export function openingReviewActorLabel(legalName:string|null,marker?:true):string {
 return legalName??(marker===true?recordedReviewAccountLabel:"—");
}
