/** PAP-1523 / PLT-ACCESS: isolated M1-A VIEW-only fixture. Not an auth/session implementation. */
export const SUPPORT_FIXTURE_ID = "PAP1523-MOCK-001";
export const SUPPORT_PREVIEW_TTL_MS = 15 * 60 * 1000;
export type SupportPreviewTarget = Readonly<{
  id: string;
  surface: "Piner App" | "TOS" | "BO";
  actor: "Student" | "Parent" | "Guest" | "Staff" | "Manager";
  scope: string;
  eligible: boolean;
  unavailableReason?: string;
}>;
export type PreviewSession = Readonly<{personId: string; target: SupportPreviewTarget; reason: string; expiresAt: number}>;
export const supportPreviewTargets: readonly SupportPreviewTarget[] = [
  {id:"student",surface:"Piner App",actor:"Student",scope:"Afterschool",eligible:true},
  {id:"parent",surface:"Piner App",actor:"Parent",scope:"Afterschool · hồ sơ con đã liên kết",eligible:true},
  {id:"guest",surface:"Piner App",actor:"Guest",scope:"MyTime",eligible:false,unavailableReason:"Chưa kích hoạt tài khoản"},
  {id:"staff",surface:"TOS",actor:"Staff",scope:"QA Center",eligible:true},
  {id:"manager",surface:"BO",actor:"Manager",scope:"QA Center",eligible:true},
];
export function startSupportPreview(personId:string,targetId:string,reason:string,now:number):PreviewSession|null {
  if(personId!==SUPPORT_FIXTURE_ID || !Number.isFinite(now)) return null;
  const target=supportPreviewTargets.find(candidate=>candidate.id===targetId&&candidate.eligible);
  const note=reason.trim();
  if(!target || !note || note.length>500) return null;
  return {personId,target,reason:note,expiresAt:now+SUPPORT_PREVIEW_TTL_MS};
}
export function previewRemainingSeconds(session:PreviewSession,now:number):number {
  return Math.max(0,Math.ceil((session.expiresAt-now)/1000));
}
