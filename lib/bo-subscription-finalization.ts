/** PAP-1100: deterministic service and placement date constraints plus Core-backed resume. */
export type RegistrationEnrollment={runningClassId:string;effectiveFromLocalDate:string;effectiveUntilExclusiveLocalDate:string|null};
const iso=/^\d{4}-\d{2}-\d{2}$/;
export function validateRegistrationDates(start:string,placement:string,end:string):string|null{
 if(!iso.test(start)||!iso.test(placement)||!iso.test(end)||end<start)return "Invalid contractual dates.";
 if(placement<start||placement>end)return "Placement start must be inside the contractual period.";
 return null;
}
export function existingRegistrationPlacements(rows:readonly RegistrationEnrollment[],at:string,allowed:ReadonlySet<string>):string[]{
 return [...new Set(rows.filter(r=>r.effectiveFromLocalDate<=at&&(r.effectiveUntilExclusiveLocalDate===null||at<r.effectiveUntilExclusiveLocalDate)&&allowed.has(r.runningClassId)).map(r=>r.runningClassId))];
}
