/** PAP-2202: a canonical Parent receipt may commit before a Guest command.
 * Never retry that Parent create under a fresh key. No contact copy or implicit identity match.
 */
import {BoApiError} from "@/lib/bo-api-error";
import type {GuardianOption} from "./GuardianPreview";
export class GuestParentCommitted extends Error {
 constructor(readonly parent:GuardianOption,readonly causeError:BoApiError){super("Đã tạo hồ sơ người giám hộ. Khách chưa được lưu; hãy sửa thông tin và tạo lại với hồ sơ này.");this.name="GuestParentCommitted";}
}
export const guestKnownFailure=(error:unknown):error is BoApiError=>error instanceof BoApiError&&error.structuredResponse&&[400,401,403,404,409,422].includes(error.status);
export async function finishGuestWithParent<T>(parent:GuardianOption|null,fn:()=>Promise<T>):Promise<T>{
 try{return await fn();}catch(e){if(parent&&guestKnownFailure(e))throw new GuestParentCommitted(parent,e);throw e;}
}
