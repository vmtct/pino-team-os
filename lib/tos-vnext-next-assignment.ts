import type {Assignment} from "./workforce-api";

/** Only confirmed ACTIVE own-center assignments are eligible for the Home card.
 * A draft, withdrawn, expired, or unknown status is never an upcoming shift. */
export function nextConfirmedAssignment(
 assignments:readonly Assignment[], centerId:string, localDate:string, nowLocalTime?:string
):Assignment|null{
 if(!centerId||!/^\d{4}-\d{2}-\d{2}$/.test(localDate))return null;
 return [...assignments]
  .filter(a=>a.centerId===centerId&&a.status==="ACTIVE"&&a.workDate>=localDate&&
   !(nowLocalTime&&a.workDate===localDate&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(nowLocalTime)&&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(a.effectiveEndLocal??a.shift?.endLocalTime??"")&&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(a.effectiveStartLocal??a.shift?.startLocalTime??"")&&
    (a.effectiveEndLocal??a.shift?.endLocalTime??"")>(a.effectiveStartLocal??a.shift?.startLocalTime??"")&&
    (a.effectiveEndLocal??a.shift?.endLocalTime??"")<=nowLocalTime))
  .sort((a,b)=>a.workDate.localeCompare(b.workDate)||
    (a.effectiveStartLocal??a.shift?.startLocalTime??"").localeCompare(
     b.effectiveStartLocal??b.shift?.startLocalTime??""))[0]??null;
}
