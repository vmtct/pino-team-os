"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { BoValue } from "./BoValue";
import { BoRegistrationHistory } from "./BoRegistrationHistory";
import { BoRunningClassEnrollment } from "./BoRunningClassEnrollment";
import { BoStudentIntakeVoid } from "./BoStudentIntakeVoid";
import { BoStudentSubscriptionRelation } from "./BoStudentSubscriptionRelation";
import {subscriptionDetailUrl} from "@/lib/bo-subscription-detail-url";
import { BoSubscriptionInformationTab } from "@/app/bo/subscriptions/BoSubscriptionInformationTab";
import { BoParentReadTabs } from "./BoParentReadTabs";
import { BoPayrollPeriodDetail } from "./BoPayrollPeriodDetail";
import { BoStaffIncomeReadTab } from "./BoStaffIncomeReadTab";
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
  module, moduleKey, record, onBack, onStudentNeutralized, mobileMenu, enableStudentSubscriptions = false, onEnrollmentChanged, initialTab, onTabChanged,
}: {
  module: BoModule;
  moduleKey: string;
  record: BoRecord;
  onBack: () => void;
  onStudentNeutralized?: () => void;
  mobileMenu: React.ReactNode;
  enableStudentSubscriptions?: boolean;
  onEnrollmentChanged?: () => void;
  initialTab?: string;
  onTabChanged?: (tab: string) => void;
}) {
  const [tab, setTab] = useState(initialTab ?? "Detail");
  useEffect(() => { setTab(initialTab ?? "Detail"); }, [initialTab]);
  const [voidOpen, setVoidOpen] = useState(false);
  const subjectType = moduleKey === "students" ? "student_profile" : moduleKey === "classes" ? "running_class" : moduleKey === "subscriptions" ? "subscription" : null;
  // Shared BO V2.5 Detail/History stays universal; specialized tabs remain module-owned.
  const tabs = moduleKey === "workforce-shift-plans" ? ["Detail", "Lịch tuần", "Lịch Sử"]
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

  // Student -> Subscription resolves the same addressable BO Subscription resource.
  // Legacy query alias is used until the canonical /bo/subscriptions/:id route is admitted.
  function openSubscriptionFromStudent(next:BoRecord){
    const url=subscriptionDetailUrl(new URL("/bo?module=subscriptions",window.location.origin).href,next.id);
    window.location.assign(url);
  }

  // Parent uses the SAME full-width Detail cover/hero/tab/body structure as Student.
  // Domain-specific read-only tabs are children of the canonical shell, never a narrow detached panel.
  if (moduleKey === "parents") return <DetailFrame title={record.name} subtitle={record.id} mobileMenu={mobileMenu} onBack={onBack}
    legacyContent={<BoParentReadTabs module={module} record={record} fullDetail />}>{null}</DetailFrame>;

  return <DetailFrame title={record.name} subtitle={record.id} mobileMenu={mobileMenu} onBack={onBack}
    tabs={tabs.map(label => ({ id: label, label: label === "Detail" ? (moduleKey === "subscriptions" ? "Thông Tin" : "Thông tin") : label }))}
    selected={activeTab} onSelect={(next) => { setTab(next); onTabChanged?.(next); }}
    after={voidOpen ? <BoStudentIntakeVoid studentId={record.id} onClose={() => setVoidOpen(false)} onNeutralized={onStudentNeutralized!} /> : null}>
          {moduleKey === "payroll-periods" && (activeTab === "Detail" || activeTab === "Quyết Toán")
            ? <BoPayrollPeriodDetail record={record} tab={activeTab} />
            : activeTab === "Lịch tuần" && moduleKey === "workforce-shift-plans"
              ? <Suspense fallback={<p role="status">Đang tải lịch tuần…</p>}><BoWorkforcePlannerTab embedded scope={{ centerId: String(record.centerId ?? ""), termWeekId: String(record.termWeekId ?? "") }} /></Suspense>
            : moduleKey === "staffs" && activeTab === "Thu nhập"
              ? <BoStaffIncomeReadTab staffMemberId={record.id} />
            : activeTab === "Detail" && moduleKey === "subscriptions"
              ? <BoSubscriptionInformationTab subscriptionId={record.id} studentName={record.name} />
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
              ? <BoStudentSubscriptionRelation studentId={record.id} onFullDetail={openSubscriptionFromStudent} />
              : activeTab === "Enrollment" && moduleKey === "classes"
                ? <BoRunningClassEnrollment runningClassId={record.id} className={record.name} pathName={typeof record.path === "string" ? record.path : "—"} centerTimeZone={typeof record.centerTimeZone === "string" ? record.centerTimeZone : null} />
              : activeTab === "Enrollment" && moduleKey === "subscriptions"
                ? <Suspense fallback={<div role="status" className="v24-audit-empty">Đang tải Enrollment…</div>}><BoSubscriptionEnrollmentTab subscriptionId={record.id} onChanged={onEnrollmentChanged} /></Suspense>
              : subjectType
                  ? <BoRegistrationHistory key={record.id} subjectType={subjectType} subjectId={record.id} />
                  : <div className="v24-audit-empty" role="status">Lịch sử chưa khả dụng.</div>}
  </DetailFrame>;
}
