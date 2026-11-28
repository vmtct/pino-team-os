// PAP-2418 · WFM-STAFF · PAP-220 Staff. Presentation contract only.
export type StaffAccountState = "missing"|"inactive"|"active"|"unknown";
export type ActivationSubject = Readonly<{id:string;name:string;status:"Ngưng"|"Đang làm";revision:string;accountState:StaffAccountState;affiliation:Readonly<{id:string;version:number;centerId:string;label:string;active:boolean}>|null}>;
export type ActivationRequest = Readonly<{staffId:string;expectedRevision:string;affiliationId:string;affiliationVersion:number;centerId:string}>;
export type ActivationResult = {kind:"activated";subject:ActivationSubject}|{kind:"stale"|"denied"|"unknown"};
// Employment activation is not operational admission. Even an active account requires independent scope/action checks.
export function operationalAccountState(subject:ActivationSubject):"account-required"|"authority-unverified" {return subject.accountState==="active"?"authority-unverified":"account-required";}
export function operationalAccountNotice(subject:ActivationSubject):string {switch(subject.accountState){case "missing":return "Chưa đủ điều kiện vận hành: cần liên kết tài khoản đang hoạt động.";case "inactive":return "Chưa đủ điều kiện vận hành: tài khoản liên kết chưa hoạt động.";case "unknown":return "Chưa xác minh điều kiện vận hành: chưa xác minh trạng thái tài khoản liên kết.";case "active":return "Chưa xác minh điều kiện vận hành: cần kiểm tra quyền và phạm vi cơ sở.";}}
export function activationRequest(subject:ActivationSubject):ActivationRequest|null {
  const a=subject.affiliation;
  if(subject.status!=="Ngưng"||!subject.id||!subject.revision||!a?.active||!a.id||!a.centerId||!a.label||!Number.isSafeInteger(a.version)||a.version<1)return null;
  return {staffId:subject.id,expectedRevision:subject.revision,affiliationId:a.id,affiliationVersion:a.version,centerId:a.centerId};
}
export function sameActivationRequest(a:ActivationRequest|null,b:ActivationRequest|null):boolean {
  return !!a&&!!b&&a.staffId===b.staffId&&a.expectedRevision===b.expectedRevision&&a.affiliationId===b.affiliationId&&a.affiliationVersion===b.affiliationVersion&&a.centerId===b.centerId;
}
export function verifiedActivation(request:ActivationRequest,subject:ActivationSubject):boolean {
  const a=subject.affiliation;
  return subject.id===request.staffId&&subject.status==="Đang làm"&&!!subject.revision&&subject.revision!==request.expectedRevision&&a?.active===true&&a.id===request.affiliationId&&a.version===request.affiliationVersion&&a.centerId===request.centerId;
}
