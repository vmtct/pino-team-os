import type {CenterRegistrationService} from "../../staff/StaffRegistrationSection";
import {createStaffRegistrationM1Service} from "./staff-registration-m1-service";
import {STAFF_DIRECTORY_MOCK_ID} from "./staff-directory-m1-fixture";
export const STAFF_M1_CENTER="STAFF-MOCK-CENTER";
/** PAP-2411: only synthetic Center, exact row, version and command shape. */
export function createStaffCenterRegistrationM1Service():CenterRegistrationService{
  const source=createStaffRegistrationM1Service();
  const check=(centerId:string)=>{if(centerId!==STAFF_M1_CENTER)throw Error("Unknown fixture Center");};
  return {
    list:async(centerId,signal)=>{check(centerId);signal.throwIfAborted();return (await source.staffRegistrationRequests()).map(({id,displayLabel,submittedAt,version})=>({id,displayLabel,submittedAt,version,centerId}));},
    roles:async(centerId,signal)=>{check(centerId);signal.throwIfAborted();return (await source.accessRoles()).map(({id,displayName})=>({id,displayName}));},
    review:async(centerId,id,mode,body,key)=>{
      check(centerId);
      if(id!==STAFF_DIRECTORY_MOCK_ID||body.expectedVersion!==1||!key.trim())throw Error("Invalid fixture identity/version");
      if(mode==="reject"){
        if(body.assignments||body.pinoriaIdentity||typeof body.reason!=="string")throw Error("Invalid reject fixture");
        return source.rejectStaffRegistration(id,body.reason,key);
      }
      const a=body.assignments;
      if(body.reason!==undefined||body.pinoriaIdentity?.mode!=="CREATE_STAFF_ONLY_PERSON"||a?.length!==1||a[0].scopeType!=="CENTER"||a[0].scopeId!==centerId)throw Error("Invalid Center fixture approval");
      return source.approveStaffRegistration(id,[{roleId:a[0].roleId,scopeType:"CENTER",scopeId:centerId}],{mode:"CREATE_STAFF_ONLY_PERSON"},key);
    },
  };
}
