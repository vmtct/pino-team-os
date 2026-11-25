/** PLT-DELIVERY / PAP-1037 / PAP-1043 / PAP-2225.
 * Presentation-only Running Class draft. Never invokes a live transport.
 * Server remains authoritative for ACL, eligibility, idempotency and persistence.
 */
export const CLASS_TOPOLOGIES = ["FIXED_COHORT", "FLEXIBLE_STUDIO", "OVERLAPPING_COHORT"] as const;
export type ClassTopology = typeof CLASS_TOPOLOGIES[number];
export type ClassCatalog = {
  centers: readonly { id: string; status: string; displayName: string }[];
  paths: readonly { id: string; status: string; displayName: string }[];
  spaces: readonly { id: string; centerId: string; status: string; displayName: string }[];
};
export type ClassDraft = {
  operationalName: string; centerId: string; pathProgramId: string; learningSpaceId: string;
  weekdayIso: number; windowStartsLocal: string; windowEndsLocal: string;
  deliveryTopology: ClassTopology; optimalConcurrentCapacity: number | null;
  hardConcurrentCapacity: number | null; defaultParticipationMinutes: number | null;
};
export type ClassCreate = Omit<ClassDraft, "optimalConcurrentCapacity"> & {
  optimalConcurrentCapacity: number; status: "INACTIVE";
};
export function initialClassDraft(selectedCenterId: string): ClassDraft {
  return { operationalName: "", centerId: selectedCenterId, pathProgramId: "", learningSpaceId: "",
    weekdayIso: 1, windowStartsLocal: "", windowEndsLocal: "", deliveryTopology: "FIXED_COHORT",
    optimalConcurrentCapacity: null, hardConcurrentCapacity: null, defaultParticipationMinutes: null };
}
const active = (row: {status: string}) => row.status.toUpperCase() === "ACTIVE";
export const eligibleClassSpaces = (catalog: ClassCatalog, centerId: string) =>
  catalog.spaces.filter(space => active(space) && space.centerId === centerId);
export function changeClassCenter(draft: ClassDraft, centerId: string): ClassDraft {
  return draft.centerId === centerId ? draft : {...draft, centerId, learningSpaceId: ""};
}
const positiveInt = (n: number | null): n is number => n !== null && Number.isSafeInteger(n) && n > 0;
function minuteOfDay(value: string): number | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0,2))*60 + Number(value.slice(3));
}
export function validateClassDraft(draft: ClassDraft, catalog: ClassCatalog):
  {ok: true; value: ClassCreate} | {ok: false; errors: Partial<Record<keyof ClassDraft,string>>} {
  const errors: Partial<Record<keyof ClassDraft,string>> = {};
  const name = draft.operationalName.trim();
  if (!name || name.length > 200) errors.operationalName = "Nhập tên lớp từ 1–200 ký tự.";
  if (!catalog.centers.some(c => c.id === draft.centerId && active(c))) errors.centerId = "Chọn cơ sở hợp lệ.";
  if (!catalog.paths.some(p => p.id === draft.pathProgramId && active(p))) errors.pathProgramId = "Chọn Path đang hoạt động.";
  if (!eligibleClassSpaces(catalog,draft.centerId).some(s => s.id === draft.learningSpaceId)) errors.learningSpaceId = "Chọn phòng đang hoạt động thuộc cơ sở.";
  if (!Number.isInteger(draft.weekdayIso) || draft.weekdayIso < 1 || draft.weekdayIso > 7) errors.weekdayIso = "Chọn một ngày trong tuần.";
  const start = minuteOfDay(draft.windowStartsLocal), end = minuteOfDay(draft.windowEndsLocal);
  if (start === null) errors.windowStartsLocal = "Nhập giờ bắt đầu.";
  if (end === null || start === null || end <= start) errors.windowEndsLocal = "Giờ kết thúc phải sau giờ bắt đầu.";
  if (!CLASS_TOPOLOGIES.includes(draft.deliveryTopology)) errors.deliveryTopology = "Chọn mô hình lớp.";
  const optimal = draft.optimalConcurrentCapacity, hard = draft.hardConcurrentCapacity, duration = draft.defaultParticipationMinutes;
  if (!positiveInt(optimal)) errors.optimalConcurrentCapacity = "Sức chứa tối ưu phải là số nguyên dương.";
  if (hard !== null && (!positiveInt(hard) || (positiveInt(optimal) && hard < optimal))) errors.hardConcurrentCapacity = "Sức chứa tối đa không được nhỏ hơn tối ưu.";
  const window = start !== null && end !== null ? end - start : 0;
  if (draft.deliveryTopology === "FLEXIBLE_STUDIO") {
    if (!positiveInt(duration) || duration > window) errors.defaultParticipationMinutes = "Thời lượng phải nằm trong khung giờ.";
  } else if (duration !== null && (!positiveInt(duration) || duration !== window)) {
    errors.defaultParticipationMinutes = "Để trống hoặc bằng thời lượng khung giờ.";
  }
  if (Object.keys(errors).length || !positiveInt(optimal)) return {ok:false, errors};
  return {ok:true,value:{...draft,operationalName:name,optimalConcurrentCapacity:optimal,status:"INACTIVE"}};
}
