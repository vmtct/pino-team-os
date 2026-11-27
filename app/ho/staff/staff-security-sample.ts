// PAP-2430 / WFM-STAFF. Hypothetical UI states only; no authentication or credentials.
export const sampleCases=["absent","present","unknown","unlinked","inactive","ambiguous","protected","denied"] as const;
export type SampleCase=typeof sampleCases[number];
export type SecuritySample={scenario:SampleCase;staffId:string;accountId:string|null;revision:number;firstChangeRequired:boolean};
export function initialSecuritySample(scenario:SampleCase):SecuritySample{
 return {scenario,staffId:"STAFF-SECURITY-SAMPLE",accountId:scenario==="unlinked"||scenario==="ambiguous"?null:"ACCESS-SECURITY-SAMPLE",revision:1,firstChangeRequired:false};
}
export function sampleAction(s:SecuritySample):"initial"|"reset"|"none"{
 if(s.staffId!=="STAFF-SECURITY-SAMPLE"||s.accountId!=="ACCESS-SECURITY-SAMPLE")return "none";
 return s.scenario==="absent"?"initial":s.scenario==="present"?"reset":"none";
}
export function simulateInitialEnrollment(s:SecuritySample,expected:{staffId:string;accountId:string|null;revision:number}):SecuritySample|null{
 if(sampleAction(s)!=="initial"||s.staffId!==expected.staffId||s.accountId!==expected.accountId||s.revision!==expected.revision)return null;
 return {...s,scenario:"present",revision:s.revision+1,firstChangeRequired:true};
}
