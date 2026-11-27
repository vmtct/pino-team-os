// PAP-2430 / WFM-STAFF. Hypothetical UI states only; no authentication or credentials.
import type {Snapshot} from "./staff-access-presentation-model";
export const sampleCases=["absent","present","unknown","unlinked","inactive","ambiguous","protected","denied"] as const;
export type SampleCase=typeof sampleCases[number];
export type SecuritySample={scenario:SampleCase;staffId:string;accountId:string|null;revision:number;firstChangeRequired:boolean};
export function initialSecuritySample(scenario:SampleCase):SecuritySample{
 return {scenario,staffId:"STAFF-SECURITY-SAMPLE",accountId:scenario==="unlinked"||scenario==="ambiguous"?null:"ACCESS-SECURITY-SAMPLE",revision:1,firstChangeRequired:false};
}
export function sampleAction(s:SecuritySample):"initial"|"reset"|"none"{
 if(!((s.staffId==="STAFF-SECURITY-SAMPLE"&&s.accountId==="ACCESS-SECURITY-SAMPLE")||(/^STAFF-MOCK-\d{3,}$/.test(s.staffId)&&s.accountId==="M1-HYPOTHETICAL-ACCOUNT:"+s.staffId)))return "none";
 return s.scenario==="absent"?"initial":s.scenario==="present"?"reset":"none";
}
export function simulateInitialEnrollment(s:SecuritySample,expected:{staffId:string;accountId:string|null;revision:number}):SecuritySample|null{
 if(sampleAction(s)!=="initial"||s.staffId!==expected.staffId||s.accountId!==expected.accountId||s.revision!==expected.revision)return null;
 return {...s,scenario:"present",revision:s.revision+1,firstChangeRequired:true};
}

// Bound M1 view: account lifecycle is the source of eligibility, not a separate status selector.
export function linkedSecuritySample(s:Snapshot,credential:"absent"|"present"|"unknown"):SecuritySample{
 const exact=/^STAFF-MOCK-\d{3,}$/.test(s.staffId)&&s.accountId==="M1-HYPOTHETICAL-ACCOUNT:"+s.staffId;
 const scenario:SampleCase=!s.accountId?"unlinked":!exact?"unknown":s.assignments.some(a=>a.protected)?"protected":s.employment!=="active"||s.accountStatus==="inactive"?"inactive":s.accountStatus!=="active"?"unknown":credential;
 return {scenario,staffId:s.staffId,accountId:s.accountId,revision:s.revision,firstChangeRequired:credential==="present"};
}
