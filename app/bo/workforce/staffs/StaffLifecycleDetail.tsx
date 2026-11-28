"use client";
import {BoProperties} from "@/app/bo/components/BoProperties";
import styles from "@/app/bo/bo.module.css";
import {formatPinoDateTime,formatPinoDateOnly} from "@/lib/pino-datetime";
import type {StaffLifecycleM1Fixture} from "./staff-lifecycle-m1-fixture";
import {currentStaffRate,staffRateReviewDate,staffRateReviewRows} from "./staff-current-rate";
/** PAP-2423 / PAP-2411: read-only record; registration workflow remains separate. */
export function StaffLifecycleDetail({fixture,recordId,centerName}:{fixture:Pick<StaffLifecycleM1Fixture,"snapshot"|"rows">;recordId:string;centerName:string}){
 const snapshot=fixture.snapshot(),profile=snapshot.profile;
 if(!profile||profile.id!==recordId)return <p role="status">{"Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1 nh\u00e2n s\u1ef1."}</p>;
 const audit=fixture.rows().find(row=>row.id===recordId);
 const rate=currentStaffRate(staffRateReviewRows(recordId),recordId,staffRateReviewDate);
 const money=rate?new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(rate.amountMinor)+" / gi\u1edd":"\u2014";
 return <section className="v24-prop-section" data-staff-directory-readonly><div className="v24-section-heading"><h4>{"Th\u00f4ng tin ch\u00ednh"}</h4></div><BoProperties authority items={[
 {key:"displayLabel",label:"H\u1ecd v\u00e0 t\u00ean",value:profile.displayLabel},
 {key:"department",label:"B\u1ed9 ph\u1eadn",value:profile.department??"\u2014"},
 {key:"employmentType",label:"Lo\u1ea1i nh\u00e2n s\u1ef1",value:profile.employmentType??"\u2014"},
 {key:"startDate",label:"Ng\u00e0y b\u1eaft \u0111\u1ea7u",value:profile.startDate?formatPinoDateOnly(profile.startDate):"\u2014"},
 {key:"email",label:"Email",value:profile.email??"\u2014"},
 {key:"mobile",label:"\u0110i\u1ec7n tho\u1ea1i",value:profile.mobile??"\u2014"},
 {key:"center",label:"C\u01a1 s\u1edf",value:centerName},
 {key:"role",label:"Vai tr\u00f2",value:profile.roleLabel??"\u2014"},
 {key:"status",label:"Tr\u1ea1ng th\u00e1i l\u00e0m vi\u1ec7c",value:profile.status==="active"?"\u0110ang l\u00e0m":"Ng\u01b0ng ho\u1ea1t \u0111\u1ed9ng"},
 {key:"account",label:"T\u00e0i kho\u1ea3n",value:"Ch\u01b0a x\u00e1c minh"},
 {key:"staffId",label:"Staff ID",value:profile.id},
 {key:"createdAt",label:"Created Time",value:formatPinoDateTime(audit?.createdAt)},
 {key:"createdBy",label:"Created By",value:String(audit?.createdBy??"\u2014")},
 {key:"updatedAt",label:"Last Modified Time",value:formatPinoDateTime(audit?.updatedAt)},
 {key:"updatedBy",label:"Last Modified By",value:String(audit?.updatedBy??"\u2014")},
 {key:"readiness",label:"\u0110i\u1ec1u ki\u1ec7n v\u1eadn h\u00e0nh",value:snapshot.operationalReadiness==="NOT_READY"?"Ch\u01b0a \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n":"Ch\u01b0a x\u00e1c minh"}
 ]}/><div data-staff-rate-current><BoProperties authority items={[
 {key:"effectiveRate",label:"Rate l\u01b0\u01a1ng hi\u1ec7u l\u1ef1c hi\u1ec7n t\u1ea1i",value:money},
 {key:"effectiveFrom",label:"Hi\u1ec7u l\u1ef1c t\u1eeb",value:rate?formatPinoDateOnly(rate.effectiveFrom):"\u2014"}
 ]}/><p className={styles.registrationPrivacyNote}>{"D\u1eef li\u1ec7u m\u1eabu M1 \u00b7 ng\u00e0y tham chi\u1ebfu 28/11/2026. HO qu\u1ea3n l\u00fd Rate; BO ch\u1ec9 \u0111\u1ecdc."}</p>{!rate&&<p role="status">{"Ch\u01b0a x\u00e1c minh Rate hi\u1ec7u l\u1ef1c."}</p>}</div>
 <p className={styles.registrationPrivacyNote}>{"HO qu\u1ea3n l\u00fd h\u1ed3 s\u01a1, t\u00e0i kho\u1ea3n v\u00e0 vai tr\u00f2. BO ch\u1ec9 \u0111\u1ecdc h\u1ed3 s\u01a1 Staff."}</p></section>;
}
