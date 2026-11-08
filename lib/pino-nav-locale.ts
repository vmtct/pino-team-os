/* PAP-1604, PAP-1605, PAP-1606 · Epic PAP-1601 / PLT-UI-LOCALE-BO-HO.
 * V1 translates sidebar group/item labels and module LIST titles only.
 * Source navigation/route/module IDs stay unchanged. This typed registry is
 * also the SOLE mapping source for the later PAP-1649 read-only HO viewer.
 */
import { boNavigation } from "@/app/bo/navigation";
import { unifiedBoWorkspaceSource } from "@/app/bo/architecture/bo-unified-workspace-source";
import { hoModules, hoRoutes } from "@/lib/ho-system";

export type PinoSurface = "bo" | "ho";
export type PinoLanguage = "vi" | "en";
export type PinoLocaleKind = "Nav Group" | "Nav Item" | "Module Title";
export type PinoLocaleRow = Readonly<{
  key: string;
  surface: "BO" | "HO";
  kind: PinoLocaleKind;
  vi: string;
  en: string;
}>;

export const pinoLocaleStorageKey = (surface: PinoSurface) =>
  "pino:" + surface + ":nav-language:v1";

/** Founder-confirmed terminology takes precedence over historical source labels. */
const terms: readonly (readonly [string, string, readonly string[]])[] = [
  ["Running Class", "Ca học", ["Running Classes", "Classes", "Lớp đang chạy", "Lớp đang hoạt động"]],
  ["Center Shift Plans", "Kế Hoạch Tuần", ["Kế hoạch ca trung tâm"]],
  ["Staff Availability", "Lịch đăng ký", ["Lịch khả dụng nhân sự"]],
  ["Subscriptions", "Gói học", ["Gói đăng ký"]],
  ["Classroom Diaries", "Nhật Ký", ["Nhật ký lớp học"]],
  ["Today", "Hôm nay", ["Hôm nay"]],
  ["Bills", "Hóa đơn", ["Hoá đơn"]],
  ["Students", "Học viên", ["Student", "Học viên"]],
  ["Student Visits", "Lượt đến học", ["Student Visit"]],
  ["Parents & Guardians", "Phụ huynh", ["Parents"]],
  ["Shift Assignments", "Phân công ca", ["Phân công ca"]],
  ["Sessions", "Buổi học", []],
  ["Registrations", "Đăng ký học", ["Enrollments"]],
  ["Activation", "Kích hoạt", []],
  ["Schedule", "Lịch", []],
  ["Holidays & closures", "Ngày nghỉ và đóng cửa", []],
  ["Leads", "Khách quan tâm", []],
  ["Open Studio", "Trạm Nghệ Thuật", []],
  ["Pass Trạm Nghệ Thuật", "Pass Trạm Nghệ Thuật", []],
  ["Programs & Syllabus", "Giáo trình", ["Syllabi", "Syllabus"]],
  ["Missions", "Nhiệm vụ", ["Mission", "Nhiệm vụ"]],
  ["Practice", "Luyện tập", []],
  ["Staff", "Nhân sự", ["Staffs"]],
  ["Schedule & Time", "Lịch và thời gian", []],
  ["Check-in Exceptions", "Ngoại lệ check-in", []],
  ["Timekeeping", "Chấm công", []],
  ["Payroll History", "Lịch sử lương", ["Lịch sử lương"]],
  ["Duty Exceptions", "Ngoại lệ nhiệm vụ", []],
  ["Payroll Periods", "Kỳ lương", ["Kỳ lương", "Salary Period", "Kỳ lương (Read-only)"]],
  ["Overtime Approvals", "Duyệt thêm giờ", ["Duyệt thêm giờ"]],
  ["Training", "Đào tạo nhân sự", []],
  ["Self Directory", "Hồ sơ Pinoria Self", ["Pinoria Self"]],
  ["Economy", "Kinh tế", []],
  ["Wish", "Điều ước", []],
  ["Activity", "Hoạt động", []],
  ["Collection", "Bộ sưu tập", []],
  ["Companions", "Bạn đồng hành", []],
  ["Wardrobe", "Tủ đồ", []],
  ["Loadouts", "Trang bị", []],
  ["Effects", "Hiệu ứng", []],
  ["TV Projection Policy", "Chính sách trình chiếu TV", []],
  ["TV Operations", "Vận hành TV", []],
  ["Website CMS", "Nội dung Website", []],
  ["Policies", "Chính sách", []],
  ["AI Data Inbox", "Hộp thư dữ liệu AI", []],
  ["Pancake", "Pancake", []],
  ["Audit", "Nhật ký kiểm toán", ["Audits", "Access Audit"]],
  ["Center", "Cơ sở", ["Centers"]],
  ["Path", "Path", []],
  ["Specialties", "Chuyên đề", ["Chuyên đề"]],
  ["Global Terms", "Học kỳ toàn hệ thống", []],
  ["TermWeek", "Tuần học", []],
  ["Shift Templates", "Mẫu ca", ["Mẫu ca"]],
  ["Walk-in Passes", "Pass tại quầy", []],
  ["Staff Links", "Liên kết nhân sự", []],
  ["Users", "Người dùng", []],
  ["Roles", "Vai trò", []],
  ["TDD Reference", "Tham chiếu TDD", []],
  ["Language Mapping", "Đối chiếu ngôn ngữ", []],
  ["World Catalog", "Danh mục thế giới", []],
  ["Wardrobe Catalog", "Danh mục trang phục", []],
  ["Wardrobe Sets", "Bộ trang phục", []],
  ["Pinoria TV", "Pinoria TV", []],
  ["Daily Payroll", "Bảng lương ngày", []],
  ["Payroll Exceptions & Overtime", "Ngoại lệ và thêm giờ", []],
  ["PTE Earnings", "Thu nhập PTE", []],
];
const clean = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
const dictionary = new Map<string, Readonly<{ vi: string; en: string }>>();
for (const [en, vi, aliases] of terms) {
  const pair = Object.freeze({ en, vi });
  for (const name of [en, vi, ...aliases]) {
    const current = dictionary.get(clean(name));
    if (current && current.en !== en) throw Error("PAP-1604 ambiguous locale label: " + name);
    dictionary.set(clean(name), pair);
  }
}
const groups: Readonly<Record<string, Readonly<{ vi: string; en: string }>>> = Object.freeze({
  "tài chính": { vi: "Tài chính", en: "Finance" },
  finance: { vi: "Tài chính", en: "Finance" },
  workspace: { vi: "Không gian làm việc", en: "Workspace" },
  school: { vi: "Trường học", en: "School" },
  operations: { vi: "Vận hành", en: "Operations" },
  learning: { vi: "Học tập", en: "Learning" },
  workforce: { vi: "Nhân sự", en: "Workforce" },
  "nhân sự": { vi: "Nhân sự", en: "Workforce" },
  pinoria: { vi: "Pinoria", en: "Pinoria" },
  content: { vi: "Nội dung", en: "Content" },
  system: { vi: "Hệ thống", en: "System" },
  "operating cycle": { vi: "Chu kỳ vận hành", en: "Operating Cycle" },
  network: { vi: "Mạng lưới", en: "Network" },
  "open studio": { vi: "Trạm Nghệ Thuật", en: "Open Studio" },
});
const perModule = new Map<string, string>([
  ["bo:classes", "Running Class"], ["bo:running-classes", "Running Class"],
  ["bo:workforce-shift-plans", "Center Shift Plans"],
  ["bo:workforce-availability", "Staff Availability"],
  ["bo:subscriptions", "Subscriptions"],
  ["bo:classroom-diaries", "Classroom Diaries"],
  ["ho:classroomDiaries", "Classroom Diaries"],
]);

function getPair(surface: PinoSurface, kind: PinoLocaleKind, id: string, label: string) {
  if (kind === "Nav Group") {
    return groups[clean(label)] ?? { vi: label, en: label };
  }
  const canonical = perModule.get(surface + ":" + id);
  const pair = canonical ? dictionary.get(clean(canonical)) : dictionary.get(clean(label));
  return pair ?? { vi: label, en: label };
}
export function pinoLocalizedLabel(
  surface: PinoSurface, kind: PinoLocaleKind, id: string, sourceLabel: string, language: PinoLanguage,
) {
  return getPair(surface, kind, id, sourceLabel)[language];
}
/** Both search languages work regardless of the currently selected language. */
export function pinoLocaleSearchMatches(
  surface: PinoSurface, id: string, label: string, search: string,
) {
  if (!search.trim()) return true;
  const pair = getPair(surface, "Nav Item", id, label);
  return [label, pair.vi, pair.en].some(value => clean(value).includes(clean(search)));
}
const rows: PinoLocaleRow[] = [];
const seen = new Set<string>();
function record(surface: PinoSurface, kind: PinoLocaleKind, id: string, label: string) {
  // Stable registry keys depend on source route/module IDs, not translated text.
  const key = surface + "." + kind.toLowerCase().replaceAll(" ", ".") + "." + id;
  if (seen.has(key)) return;
  seen.add(key);
  const pair = getPair(surface, kind, id, label);
  rows.push(Object.freeze({ key, surface: surface.toUpperCase() as "BO" | "HO", kind, vi: pair.vi, en: pair.en }));
}
for (const group of boNavigation) {
  record("bo", "Nav Group", clean(group.label), group.label);
  for (const item of group.items) {
    if (item.href) record("bo", "Nav Item", "route." + item.href, item.label);
    for (const child of item.children ?? []) {
      if (child.href) record("bo", "Nav Item", "route." + child.href, child.label);
    }
  }
}
for (const [key, module] of Object.entries(unifiedBoWorkspaceSource.modules)) {
  record("bo", "Nav Group", clean(module.group ?? "School"), module.group ?? "School");
  record("bo", "Nav Item", key, module.label);
  record("bo", "Module Title", key, module.label);
}
for (const [key, module] of Object.entries(hoModules)) {
  record("ho", "Nav Group", clean(module.group ?? "System"), module.group ?? "System");
  record("ho", "Nav Item", key, module.label);
  record("ho", "Module Title", key, module.label);
}
export const pinoLocaleRows: readonly PinoLocaleRow[] = Object.freeze(rows);
