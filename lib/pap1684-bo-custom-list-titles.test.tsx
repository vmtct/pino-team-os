/* PAP-1684 / PAP-1605 · Epic PAP-1601: actual custom BO list titles match typed shared VI/EN locale.
 * Statically pins exact list H1 locations; renders each title through production
 * React provider to prevent an inert label even if a source string is localized.
 * No tests of Drawer/Detail copy, those must remain untouched.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PinoNavLocaleContext, LocalizedModuleTitle } from "./pino-nav-locale-context";

const entries: readonly (readonly [string,string,string,string])[] = [
 ["calendar/BoCalendarClosuresView.tsx","calendar","Holidays & closures","Ngày nghỉ và đóng cửa"],
 ["content/WebsiteCmsView.tsx","content","Website CMS","Nội dung Website"],
 ["delivery-activation/DeliveryActivationView.tsx","delivery-activation","Activation","Kích hoạt"],
 ["learners/BoLearnersView.tsx","learners","Students","Học viên"],
 ["missions/MissionCatalogView.tsx","missions","Missions","Nhiệm vụ"],
 ["open-studio/OpenStudioView.tsx","open-studio","Open Studio","Trạm Nghệ Thuật"],
 ["pinoria-activities/PinoriaActivitiesView.tsx","pinoria-activities","Activity","Hoạt động"],
 ["pinoria-companions/PinoriaCompanionsView.tsx","pinoria-companions","Companions","Bạn đồng hành"],
 ["pinoria-effects/EffectCatalogView.tsx","pinoria-effects","Effects","Hiệu ứng"],
 ["pinoria-tv-policy/TvPolicyEditor.tsx","pinoria-tv-policy","TV Projection Policy","Chính sách trình chiếu TV"],
 ["practice/PracticeAccessView.tsx","practice","Practice","Luyện tập"],
 ["sales/leads/SalesLeadPipelineView.tsx","sales/leads","Leads","Khách quan tâm"],
 ["staff/StaffManagementView.tsx","staff","Staff","Nhân sự"],
 ["student-visits/StudentVisitsView.tsx","student-visits","Student Visits","Lượt đến học"],
 ["subscriptions/BoSubscriptionsView.tsx","subscriptions","Subscriptions","Gói học"],
 ["syllabus/LearningSyllabusDesk.tsx","syllabus","Programs & Syllabus","Giáo trình"],
 ["system/ai-data/AiDataInboxView.tsx","system/ai-data","AI Data Inbox","Hộp thư dữ liệu AI"],
 ["system/audit/AccessAuditView.tsx","system/audit","Audit","Nhật ký kiểm toán"],
 ["system/pancake/PancakeIntegrationView.tsx","system/pancake","Pancake","Pancake"],
 ["system/policies/WeekControlPoliciesView.tsx","system/policies","Policies","Chính sách"],
 ["system/policies/WorkforcePoliciesView.tsx","system/policies","Policies","Chính sách"],
 ["training/TrainingAssignmentsView.tsx","training","Training","Đào tạo nhân sự"],
 ["workforce/CheckInExceptionsView.tsx","workforce/check-in-exceptions","Check-in Exceptions","Ngoại lệ check-in"],
 ["workforce/duty-exceptions/DutyExceptionsView.tsx","workforce/duty-exceptions","Duty Exceptions","Ngoại lệ nhiệm vụ"],
 ["workforce/payroll/PayrollPeriodsView.tsx","workforce/payroll","Payroll Periods","Kỳ lương"],
 ["workforce/timekeeping/TimekeepingView.tsx","workforce/timekeeping","Timekeeping","Chấm công"],
 ["workforce/compensation/StaffCompensationView.tsx","workforce/compensation","Payroll History","Lịch sử lương"],
 ["workforce/payroll/extra-time/PayrollExtraReviewView.tsx","workforce/payroll/extra-time","Overtime Approvals","Duyệt thêm giờ"],
];
const labels = new Set<string>();
for (const [relative, moduleKey, en, vi] of entries) {
  test("BO custom list VI/EN "+relative, () => {
    assert.ok(!labels.has(relative), "unique source file");
    labels.add(relative);
    const source = readFileSync(resolve("app/bo",relative),"utf8");
    const jsx = '<h1><LocalizedModuleTitle label="'+en+'" moduleKey="'+moduleKey+'" /></h1>';
    assert.equal(source.split(jsx).length-1,1,"exactly one localized H1");
    assert.equal(source.split('import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";').length-1,1,"one React locale import");
    const node=createElement("h1",null,createElement(LocalizedModuleTitle,{label:en,moduleKey}));
    const render=(language:"vi"|"en")=>renderToStaticMarkup(createElement(PinoNavLocaleContext.Provider,{value:{surface:"bo",language}},node));
    assert.equal(render("en"),"<h1>"+en.replaceAll("&","&amp;")+"</h1>");
    assert.equal(render("vi"),"<h1>"+vi.replaceAll("&","&amp;")+"</h1>");
  });
}
test("staff detail label and business copy never localized",()=>{
 const src=readFileSync(resolve("app/bo/staff/StaffManagementView.tsx"),"utf8");
 assert.match(src,/<h1>Chi tiết nhân viên<\/h1>/,"Staff detail H1 stays untouched");
 assert.doesNotMatch(src,/<LocalizedModuleTitle[^>]+moduleKey="detail"/);
});
test("Founder five exact V1 terms retained in shared registry",()=>{
 const src=readFileSync(resolve("lib/pino-nav-locale.ts"),"utf8");
 for(const pair of [
  ['"Running Class", "Ca học"'],['"Center Shift Plans", "Kế Hoạch Tuần"'],
  ['"Staff Availability", "Lịch đăng ký"'],['"Subscriptions", "Gói học"'],
  ['"Classroom Diaries", "Nhật Ký"']
 ])assert.ok(src.includes(pair[0]),"Founder glossary "+pair[0]);
});
