"use client";

import { lazy, Suspense, useState } from "react";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { BoValue } from "./BoValue";
import { BoRegistrationHistory } from "./BoRegistrationHistory";
import { BoRunningClassEnrollment } from "./BoRunningClassEnrollment";
import { BoStudentIntakeVoid } from "./BoStudentIntakeVoid";
import { BoStudentSubscriptionRelation, subscriptionModule } from "./BoStudentSubscriptionRelation";
import { BoParentReadTabs } from "./BoParentReadTabs";
import { BoPayrollPeriodDetail } from "./BoPayrollPeriodDetail";
import { BoStaffIncomeReadTab } from "./BoStaffIncomeReadTab";
const HoStaffRateTab = lazy(async()=>{ const {HoStaffRateTab} = await import("@/app/ho/staff/HoStaffRateTab"); return {default:HoStaffRateTab}; });
const BoSubscriptionEnrollmentTab = lazy(async () => {
  // Node SSR of Detail must not eagerly import the DataGrid CSS module.
  // S3 Enrollment is loaded only when its tab is opened.
  const { BoSubscriptionEnrollmentTab } = await import("@/app/bo/subscriptions/BoSubscriptionEnrollmentTab");
  return { default: BoSubscriptionEnrollmentTab };
});
const BoWorkforcePlannerTab = lazy(async () => {
  const { WorkforcePlanningView } = await import("@/app/bo/workforce/WorkforcePlanningView");
  return { default: WorkforcePlanningView };
});
import type { BoModule, BoRecord } from "@/lib/bo-registration";

export function BoFullDetail({
  module, moduleKey, record, onBack, onStudentNeutralized, mobileMenu, surface = "bo", enableStudentSubscriptions = false, onEnrollmentChanged,
}: {
  module: BoModule;
  moduleKey: string;
  surface?: "bo"|"ho";
  record: BoRecord;
  onBack: () => void;
  onStudentNeutralized?: () => void;
  mobileMenu: React.ReactNode;
  enableStudentSubscriptions?: boolean;
  onEnrollmentChanged?: () => void;
}) {
  const [tab, setTab] = useState("Detail");
  const [voidOpen, setVoidOpen] = useState(false);
  const [subscriptionDetail, setSubscriptionDetail] = useState<BoRecord | null>(null);
  const subjectType = moduleKey === "students" ? "student_profile" : moduleKey === "classes" ? "running_class" : null;
  // Shared BO V2.5 Detail/History stays universal; specialized tabs remain module-owned.
  const tabs = surface==="ho" && moduleKey==="staffs" ? ["Detail","Rate lương","Lịch Sử"] : moduleKey === "workforce-shift-plans" ? ["Detail", "Lịch tuần", "Lịch Sử"]
    : moduleKey === "classes"
    ? ["Detail", "Enrollment", "Lịch Sử"]
    : moduleKey === "payroll-periods"
    ? ["Detail", "Quyết Toán", "Lịch Sử"]
    : moduleKey === "staffs"
    ? ["Detail", "Thu nhập", "Lịch Sử"]
    : moduleKey === "subscriptions"
    ? ["Detail", "Enrollment", "Lịch Sử"]
    : moduleKey === "students" && enableStudentSubscriptions
    ? ["Detail", "Subscription", "Lịch Sử"]
    : ["Detail", "Lịch Sử"];
  const selectedTabIndex = tabs.indexOf(tab);
  const activeTab = selectedTabIndex >= 0 ? tab : "Detail";

  // Reuse the same active V2.5 shell for a Subscription, never the alternate /bo/learners detail.
  if (subscriptionDetail) return <BoFullDetail
    key={subscriptionDetail.id}
    module={subscriptionModule}
    moduleKey="subscriptions"
    record={subscriptionDetail}
    mobileMenu={mobileMenu}
    onBack={() => setSubscriptionDetail(null)}
  />;

  // Parent uses the SAME full-width Detail cover/hero/tab/body structure as Student.
  // Domain-specific read-only tabs are children of the canonical shell, never a narrow detached panel.
  if (moduleKey === "parents") return <DetailFrame title={record.name} subtitle={record.id} mobileMenu={mobileMenu} onBack={onBack}
    legacyContent={<BoParentReadTabs module={module} record={record} fullDetail />}>{null}</DetailFrame>;

  return <DetailFrame title={record.name} subtitle={record.id} mobileMenu={mobileMenu} onBack={onBack}
    tabs={tabs.map(label => ({ id: label, label: label === "Detail" ? (surface==="ho" && moduleKey==="staffs" ? "Tổng quan" : "Thông tin") : label }))}
    selected={activeTab} onSelect={setTab}
    after={voidOpen ? <BoStudentIntakeVoid studentId={record.id} onClose={() => setVoidOpen(false)} onNeutralized={onStudentNeutralized!} /> : null}>
          {moduleKey === "payroll-periods" && (activeTab === "Detail" || activeTab === "Quyết Toán")
            ? <BoPayrollPeriodDetail record={record} tab={activeTab} />
            : activeTab === "Lịch tuần" && moduleKey === "workforce-shift-plans"
              ? <Suspense fallback={<p role="status">Đang tải lịch tuần…</p>}><BoWorkforcePlannerTab embedded scope={{ centerId: String(record.centerId ?? ""), termWeekId: String(record.termWeekId ?? "") }} /></Suspense>
            : surface==="ho" && moduleKey==="staffs" && activeTab==="Rate lương"
              ? <Suspense fallback={<div role="status" className="v24-audit-empty">Đang tải Rate lương…</div>}><HoStaffRateTab key={record.id} staffId={record.id}/></Suspense>
            : moduleKey === "staffs" && activeTab === "Thu nhập"
              ? <BoStaffIncomeReadTab staffMemberId={record.id} />
            : activeTab === "Detail"
            ? <section className="v24-prop-section">
                <div className="v24-section-heading">
                  <h4>Thông tin chính</h4>
                  {moduleKey === "students" && onStudentNeutralized
                    ? <button type="button" className="secondary-btn" onClick={() => setVoidOpen(true)}>Lưu trữ intake</button>
                    : null}
                </div>
                <div className="v24-prop-grid">
                  {module.fields.map(field => <div className="v24-prop-item" key={field.key}>
                    <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}</div>
                    <div className="v24-prop-value readonly" aria-label={"Chỉ đọc " + field.label}>
                      <BoValue field={field} value={record[field.key]} full />
                      <span className="v24-lock" aria-label="Chỉ đọc">⌁</span>
                    </div>
                  </div>)}
                </div>
              </section>
            : activeTab === "Subscription" && moduleKey === "students" && enableStudentSubscriptions
              ? <BoStudentSubscriptionRelation studentId={record.id} onFullDetail={setSubscriptionDetail} />
              : activeTab === "Enrollment" && moduleKey === "classes"
                ? <BoRunningClassEnrollment runningClassId={record.id} className={record.name} pathName={typeof record.path === "string" ? record.path : "—"} centerTimeZone={typeof record.centerTimeZone === "string" ? record.centerTimeZone : null} />
              : activeTab === "Enrollment" && moduleKey === "subscriptions"
                ? <Suspense fallback={<div role="status" className="v24-audit-empty">Đang tải Enrollment…</div>}><BoSubscriptionEnrollmentTab subscriptionId={record.id} onChanged={onEnrollmentChanged} /></Suspense>
              : subjectType
                  ? <BoRegistrationHistory key={record.id} subjectType={subjectType} subjectId={record.id} />
                  : <div className="v24-audit-empty" role="status">Lịch sử chưa khả dụng.</div>}
  </DetailFrame>;
}
