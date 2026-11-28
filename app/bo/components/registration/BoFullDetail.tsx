"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { BoValue } from "./BoValue";
import { BoRegistrationHistory } from "./BoRegistrationHistory";
import { BoRunningClassEnrollment } from "./BoRunningClassEnrollment";
import { RunningClassDetailProperties } from "../../running-classes/RunningClassDraftControls";
import type { RunningClassProvider } from "../../running-classes/running-class-provider";
import type { ClassEditCommand } from "../../running-classes/running-class-presentation";
import type { RunningClassReview } from "../../running-classes/running-class-review";
import { BoStudentSubscriptionRelation } from "./BoStudentSubscriptionRelation";
import {subscriptionDetailUrl} from "@/lib/bo-subscription-detail-url";
import { BoSubscriptionInformationTab } from "@/app/bo/subscriptions/BoSubscriptionInformationTab";
import { BoParentReadTabs } from "./BoParentReadTabs";
import { BoPayrollPeriodDetail } from "./BoPayrollPeriodDetail";
import { BoStaffIncomeReadTab } from "./BoStaffIncomeReadTab";
import { BoWorkforceRegistrationEditor } from "./BoWorkforceRegistrationEditor";
import { BoStudentNameInlineCell } from "./BoStudentNameInlineCell";
import { BoStudentBirthDateLocalField, BoStudentDetailLocalField, isStudentHouseMemberField, studentEditableKind } from "./BoStudentDetailLocalField";
import { useBoCenterSelection } from "./BoCenterSelection";
const BoStudentDiaryRelation = lazy(() => import("./BoStudentDiaryRelation").then(module => ({ default: module.BoStudentDiaryRelation })));
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
// PAP-1496 / SPEC-UNLOCK: one canonical Student Full Detail on /bo,
// not the deliberately retired /bo/learners Staging route.
const BoSubscriptionSpecialtyTab = lazy(async () => {
  const {BoSubscriptionSpecialtyTab} = await import("@/app/bo/subscriptions/BoSubscriptionSpecialtyTab");
  return {default:BoSubscriptionSpecialtyTab};
});
const BoStudentSpecialtyTab = lazy(async () => {
  const { StudentSpecialtyTab } = await import("@/app/bo/learners/StudentSpecialtyTab");
  return { default: StudentSpecialtyTab };
});
import type { BoModule, BoRecord } from "@/lib/bo-registration";

export function BoFullDetail({
  module, moduleKey, record, onBack, onStudentRenamed, mobileMenu, enableStudentSubscriptions = false, onEnrollmentChanged, onWorkforcePlanChanged, initialTab, onTabChanged, reviewOnly = false, staffReviewOnly = false, staffDetailContent, runningClassReview, onRunningClassSaved, runningClassLive, runningClassLiveEditable, onRunningClassLiveEdit,
}: {
  module: BoModule;
  moduleKey: string;
  record: BoRecord;
  onBack: () => void;
  onStudentRenamed?: (nextName: string) => void;
  mobileMenu: React.ReactNode;
  enableStudentSubscriptions?: boolean;
  onEnrollmentChanged?: () => void;
  onWorkforcePlanChanged?: (open: boolean) => void;
  reviewOnly?: boolean;
  staffReviewOnly?: boolean;
  staffDetailContent?: React.ReactNode;
  runningClassReview?: RunningClassReview;
  runningClassLive?: RunningClassProvider;
  runningClassLiveEditable?: boolean;
  onRunningClassLiveEdit?: (command:ClassEditCommand)=>Promise<void>;
  onRunningClassSaved?: (record:BoRecord)=>void;
  initialTab?: string;
  onTabChanged?: (tab: string) => void;
}) {
  const center = useBoCenterSelection();
  const centerId = center?.selected ?? "";
  const centerReady = Boolean(centerId) && !center?.loading && !center?.error && Boolean(center?.centers.some(item => item.id === centerId));
  const [tab, setTab] = useState(initialTab ?? "Detail");
  const [diaryFullDetail,setDiaryFullDetail]=useState<{module:BoModule;record:BoRecord}|null>(null);
  useEffect(() => { setTab(initialTab ?? "Detail"); }, [initialTab]);
  const subjectType = moduleKey === "students" ? "student_profile" : moduleKey === "classes" ? "running_class" : moduleKey === "subscriptions" ? "subscription" : null;
  // Shared BO V2.5 Detail/History stays universal; specialized tabs remain module-owned.
  const tabs = reviewOnly ? ["Detail"] : moduleKey === "workforce-shift-plans" ? ["Detail", "Lịch tuần", "Lịch Sử"]
    : moduleKey === "classes"
    ? ["Detail", "Enrollment", "Lịch Sử"]
    : moduleKey === "payroll-periods"
    ? ["Detail", "Quyết Toán", "Lịch Sử"]
    : moduleKey === "staffs"
    ? ["Detail", "Thu nhập", "Lịch Sử"]
    : moduleKey === "subscriptions"
    ? ["Detail", "Enrollment", "Chuyên đề", "Lịch Sử"]
    : moduleKey === "students" && enableStudentSubscriptions
    ? ["Detail", "Diary", "Subscription", "Chuyên đề", "Lịch Sử"]
    : moduleKey === "students"
    ? ["Detail", "Diary", "Lịch Sử"]
    : ["Detail", "Lịch Sử"];
  const classRecord = moduleKey === "classes" ? (runningClassReview?.find(record.id) ?? runningClassLive?.find(record.id)) : undefined;
  const selectedTabIndex = tabs.indexOf(tab);
  const activeTab = selectedTabIndex >= 0 ? tab : "Detail";

  // Student -> Subscription resolves the same addressable BO Subscription resource.
  // Legacy query alias is used until the canonical /bo/subscriptions/:id route is admitted.
  function openSubscriptionFromStudent(next:BoRecord){
    const url=subscriptionDetailUrl(new URL("/bo?module=subscriptions",window.location.origin).href,next.id);
    window.location.assign(url);
  }

  async function openDiaryFullDetail(next:BoRecord){
    const {diaryRawModule}=await import("./BoStudentDiaryRelation");
    setDiaryFullDetail({module:diaryRawModule,record:next});
  }
  if(moduleKey==="students"&&diaryFullDetail) return <BoFullDetail
    module={diaryFullDetail.module} moduleKey="path-diaries" record={diaryFullDetail.record}
    onBack={()=>setDiaryFullDetail(null)} mobileMenu={mobileMenu} reviewOnly={reviewOnly}
  />;

  // Parent uses the SAME full-width Detail cover/hero/tab/body structure as Student.
  // Domain-specific read-only tabs are children of the canonical shell, never a narrow detached panel.
  if (moduleKey === "parents") return <DetailFrame title={record.name} subtitle={record.id} mobileMenu={mobileMenu} onBack={onBack}
    legacyContent={<BoParentReadTabs module={module} record={record} fullDetail />}>{null}</DetailFrame>;

  return <DetailFrame title={moduleKey === "workforce-shift-plans" ? "Kế hoạch ca · " + record.name : record.name}
    subtitle={moduleKey === "workforce-shift-plans" ? String(record.centerName ?? record.id) : record.id}
    mobileMenu={mobileMenu} onBack={onBack}
    tabs={tabs.map(label => ({ id: label, label: label === "Detail" ? (moduleKey === "subscriptions" ? "Thông Tin" : "Thông tin") : label }))}
    selected={activeTab} onSelect={(next) => { setTab(next); onTabChanged?.(next); }}>
          {moduleKey === "payroll-periods" && (activeTab === "Detail" || activeTab === "Quyết Toán")
            ? <BoPayrollPeriodDetail record={record} tab={activeTab} />
            : activeTab === "Lịch tuần" && moduleKey === "workforce-shift-plans"
              ? <Suspense fallback={<p role="status">Đang tải lịch tuần…</p>}><BoWorkforcePlannerTab embedded scope={{ centerId: String(record.centerId ?? ""), termWeekId: String(record.termWeekId ?? "") }} /></Suspense>
            : moduleKey === "staffs" && activeTab === "Thu nhập"
              ? <BoStaffIncomeReadTab staffMemberId={record.id} load={staffReviewOnly ? async () => [] : undefined} />
            : activeTab === "Detail" && moduleKey === "subscriptions"
              ? <BoSubscriptionInformationTab subscriptionId={record.id} studentName={record.name} />
            : activeTab === "Detail" && moduleKey === "staffs" && staffReviewOnly && staffDetailContent
              ? staffDetailContent
            : activeTab === "Detail" && classRecord && runningClassReview
              ? <RunningClassDetailProperties record={classRecord} catalog={runningClassReview.catalog} centerToday={runningClassReview.centerToday} editable={Boolean(onRunningClassSaved)} onSave={command=>onRunningClassSaved?.(runningClassReview.edit(command))}/>
            : activeTab === "Detail" && classRecord && runningClassLive
              ? <RunningClassDetailProperties record={classRecord} catalog={runningClassLive.catalog()} centerToday={runningClassLive.centerToday()} editable={Boolean(runningClassLiveEditable&&onRunningClassLiveEdit)} onSave={command=>onRunningClassLiveEdit?.(command)}/>
            : activeTab === "Detail"
            ? <section className="v24-prop-section">
                <div className="v24-section-heading">
                  <h4>Thông tin chính</h4>

                </div>
                <div className="v24-prop-grid">
                  {module.fields.filter(field => moduleKey !== "students" || !isStudentHouseMemberField(field)).map(field => moduleKey === "students" && field.key === (module.fields.some(candidate => candidate.key === "birthDay") ? "birthDay" : "birthYear")
                    ? <BoStudentBirthDateLocalField key={record.id + ":birthDate:" + centerId + ":" + centerReady} record={record} centerId={!reviewOnly && centerReady ? centerId : ""} />
                    : moduleKey === "students" && ["birthMonth", "birthYear"].includes(field.key)
                      ? null
                      : moduleKey === "workforce-shift-plans" && field.key === "registrationOpen"
                    ? <BoWorkforceRegistrationEditor key={field.key} record={record} onSaved={open => onWorkforcePlanChanged?.(open)} />
                    : moduleKey === "students" && field.key === "name" && onStudentRenamed
                      ? <BoStudentNameInlineCell key={record.id + ":" + centerId} studentId={record.id}
                          displayName={record.name} centerId={centerId} centerReady={centerReady} onSaved={onStudentRenamed} />
                    : reviewOnly && moduleKey === "students" && studentEditableKind(field)
                      ? <BoStudentDetailLocalField key={record.id + ":" + field.key} field={field} value={record[field.key]} />
                    : <div className="v24-prop-item" key={field.key}>
                    <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}</div>
                    <div className="v24-prop-value readonly" aria-label={"Chỉ đọc " + field.label}>
                      <BoValue field={field} value={record[field.key]} full />
                      <span className="v24-lock" aria-label="Chỉ đọc">⌁</span>
                    </div>
                  </div>)}
                  {!reviewOnly && moduleKey === "students" && <BoStudentNameInlineCell key={"gender:" + record.id + ":" + centerId} studentId={record.id} displayName={record.name} centerId={centerId} centerReady={centerReady} editGender />}
                </div>
              </section>
            : activeTab === "Diary" && moduleKey === "students"
              ? <Suspense fallback={<p role="status">Đang tải Diary…</p>}>
                  <BoStudentDiaryRelation key={record.id+":"+centerId} studentId={record.id} studentName={record.name}
                    centerId={centerId} centerReady={centerReady} onFullDetail={openDiaryFullDetail} />
                </Suspense>
            : activeTab === "Subscription" && moduleKey === "students" && enableStudentSubscriptions
              ? <BoStudentSubscriptionRelation studentId={record.id} onFullDetail={openSubscriptionFromStudent} />
              : activeTab === "Chuyên đề" && moduleKey === "students" && enableStudentSubscriptions
              ? <Suspense fallback={<p role="status">Đang tải Chuyên đề…</p>}>
                  <BoStudentSpecialtyTab items={undefined} currentCenterLocalDate="" readOnly />
                </Suspense>
              : activeTab === "Enrollment" && moduleKey === "classes"
                ? <BoRunningClassEnrollment fixtureEmpty={Boolean(runningClassReview)} runningClassId={record.id} className={record.name} pathName={typeof record.path === "string" ? record.path : "—"} centerTimeZone={typeof record.centerTimeZone === "string" ? record.centerTimeZone : null} />
              : activeTab === "Enrollment" && moduleKey === "subscriptions"
                ? <Suspense fallback={<div role="status" className="v24-audit-empty">Đang tải Enrollment…</div>}><BoSubscriptionEnrollmentTab subscriptionId={record.id} onChanged={onEnrollmentChanged} /></Suspense>
              : activeTab === "Chuyên đề" && moduleKey === "subscriptions"
                ? <Suspense fallback={<div role="status" className="v24-audit-empty">Đang tải Chuyên đề…</div>}>
                    <BoSubscriptionSpecialtyTab key={record.id + ":" + centerId} subscriptionId={record.id} centerId={centerId} centerReady={centerReady}/>
                  </Suspense>
              : subjectType
                  ? <BoRegistrationHistory fixtureEmpty={Boolean(runningClassReview)} key={record.id} subjectType={subjectType} subjectId={record.id} />
                  : <div className="v24-audit-empty" role="status">Lịch sử chưa khả dụng.</div>}
  </DetailFrame>;
}
