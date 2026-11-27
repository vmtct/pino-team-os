export type LeadM1Role = "PARENT" | "STUDENT" | "GUEST";
export type LeadM1Lifecycle = "ACTIVE" | "ARCHIVED";
export type LeadM1IntentKind = "AFTERSCHOOL_ART" | "AFTERSCHOOL_PIANO" | "MYTIME_ACRYLIC" | "MYTIME_PIANO" | "OPEN_STUDIO" | "GENERAL";
export type LeadM1IntentStatus = "SUBMITTED" | "CONTACTED" | "CONTACT_VERIFIED" | "CLOSED";

export type LeadM1Member = {
  id: string; name: string; age: number | null; gender: "Nữ" | "Nam" | "Khác" | "—";
  roles: LeadM1Role[]; primaryContact: boolean; interestKinds?: LeadM1IntentKind[];
};
export type LeadM1Relationship = { id: string; fromMemberId: string; toMemberId: string; label: string; status: "DECLARED" | "CONFIRMED" };
export type LeadM1Intent = {
  id: string; kind: LeadM1IntentKind; source: "PINO Afterschool" | "MyTime by PINO" | "Open Studio" | "Nhập thủ công";
  memberIds: string[]; status: LeadM1IntentStatus; createdAt: null;
};
export type LeadM1Record = {
  id: string; fixture: boolean; contactName: string; phone: string; lifecycle: LeadM1Lifecycle;
  memberCount?: number; intentCount?: number; interestKinds?: LeadM1IntentKind[];
  websiteSubmittedName?: string | null; websiteProgram?: "AFTERSCHOOL" | "MYTIME" | null;
  members: LeadM1Member[]; relationships: LeadM1Relationship[]; intents: LeadM1Intent[];
  createdAt: string | null; createdBy: string | null; updatedAt: string | null; updatedBy: string | null;
};
export type LeadM1AuditColumn = {
  key: "createdAt" | "createdBy" | "updatedAt" | "updatedBy";
  label: "Created Time" | "Created By" | "Last Modified Time" | "Last Modified By";
  type: "datetime" | "actor"; source: "Core acquisition lead projection"; sourceReadiness: "NOT_READY_BE_DEPENDENCY"; dependency: "PAP-2287 / PAP-2288"; fallback: "—";
};
export const LEAD_M1_AUDIT_COLUMNS: readonly LeadM1AuditColumn[] = [
  { key: "createdAt", label: "Created Time", type: "datetime", source: "Core acquisition lead projection", sourceReadiness: "NOT_READY_BE_DEPENDENCY", dependency: "PAP-2287 / PAP-2288", fallback: "—" },
  { key: "createdBy", label: "Created By", type: "actor", source: "Core acquisition lead projection", sourceReadiness: "NOT_READY_BE_DEPENDENCY", dependency: "PAP-2287 / PAP-2288", fallback: "—" },
  { key: "updatedAt", label: "Last Modified Time", type: "datetime", source: "Core acquisition lead projection", sourceReadiness: "NOT_READY_BE_DEPENDENCY", dependency: "PAP-2287 / PAP-2288", fallback: "—" },
  { key: "updatedBy", label: "Last Modified By", type: "actor", source: "Core acquisition lead projection", sourceReadiness: "NOT_READY_BE_DEPENDENCY", dependency: "PAP-2287 / PAP-2288", fallback: "—" },
];
export const LEAD_M1_INTEREST_LABELS: Record<LeadM1IntentKind, string> = {
  AFTERSCHOOL_ART: "Afterschool · Hội họa", AFTERSCHOOL_PIANO: "Afterschool · Piano",
  MYTIME_ACRYLIC: "MyTime · Hội họa", MYTIME_PIANO: "MyTime · Piano",
  OPEN_STUDIO: "Open Studio", GENERAL: "Tư vấn chung",
};
export function leadM1RoleLabel(role: LeadM1Role): string {
  return ({ PARENT: "Parent", STUDENT: "Student", GUEST: "Guest" })[role];
}
export function leadM1IntentStatusLabel(status: LeadM1IntentStatus): string {
  return ({ SUBMITTED: "Mới gửi", CONTACTED: "Đã liên hệ", CONTACT_VERIFIED: "Đã xác minh liên hệ", CLOSED: "Đã đóng" })[status];
}
export function leadM1MemberSummary(lead: LeadM1Record): string {
  const counts = lead.members.reduce<Record<LeadM1Role, number>>((acc, member) => {
    member.roles.forEach(role => { acc[role] += 1; });
    return acc;
  }, { PARENT: 0, STUDENT: 0, GUEST: 0 });
  return (["PARENT", "STUDENT", "GUEST"] as const).filter(role => counts[role] > 0)
    .map(role => counts[role] + " " + leadM1RoleLabel(role)).join(" · ");
}
export function leadM1SearchText(lead: LeadM1Record): string {
  return [lead.id, lead.contactName, lead.phone,
    ...lead.members.flatMap(member => [member.name, ...member.roles.map(leadM1RoleLabel)]),
    ...lead.intents.map(intent => LEAD_M1_INTEREST_LABELS[intent.kind])].join(" ").toLocaleLowerCase("vi");
}
