"use client";

import { useState } from "react";
import { BoValue } from "./BoValue";
import { BoRegistrationHistory } from "./BoRegistrationHistory";
import { BoStudentIntakeVoid } from "./BoStudentIntakeVoid";
import { BoStudentSubscriptionRelation, subscriptionModule } from "./BoStudentSubscriptionRelation";
import { BoParentReadTabs } from "./BoParentReadTabs";
import type { BoModule, BoRecord } from "@/lib/bo-registration";

export function BoFullDetail({
  module, moduleKey, record, onBack, onStudentNeutralized, mobileMenu, enableStudentSubscriptions = false,
}: {
  module: BoModule;
  moduleKey: string;
  record: BoRecord;
  onBack: () => void;
  onStudentNeutralized?: () => void;
  mobileMenu: React.ReactNode;
  enableStudentSubscriptions?: boolean;
}) {
  const [tab, setTab] = useState("Detail");
  const [voidOpen, setVoidOpen] = useState(false);
  const [subscriptionDetail, setSubscriptionDetail] = useState<BoRecord | null>(null);
  const subjectType = moduleKey === "students" ? "student_profile" : moduleKey === "classes" ? "running_class" : null;
  const tabs = moduleKey === "subscriptions" ? ["Detail", "Enrollment", "Chuyên Sâu", "Lịch Sử"] : moduleKey === "students" && enableStudentSubscriptions
    ? ["Detail", "Subscription", "Chuyên Sâu", "Lịch Sử"]
    : ["Detail", "Chuyên Sâu", "Lịch Sử"];
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

  // The Parent drawer keeps its own read-only tabs without changing the new
  // canonical Student -> Subscription full-detail flow from main.
  if (moduleKey === "parents") return <section id="detail-screen">
    <div className="detail-cover"><div className="detail-hero"><div className="detail-hero-primary">
      {mobileMenu}
      <button type="button" id="back-to-list" className="detail-hero-back"
        title="Quay lại bảng" aria-label="Quay lại bảng" onClick={onBack}>←</button>
      <div className="detail-hero-copy"><h1 id="detail-title">{record.name}</h1><p id="detail-subtitle">{record.id}</p></div>
    </div></div></div>
    <div className="detail-main v25-full-width"><div className="detail-panel v24-main-panel">
      <BoParentReadTabs module={module} record={record} />
    </div></div>
  </section>;

  return <section id="detail-screen">
    <div className="detail-cover">
      <div className="detail-hero">
        <div className="detail-hero-primary">
          {mobileMenu}
          <button type="button" id="back-to-list" className="detail-hero-back" title="Quay lại bảng" aria-label="Quay lại bảng" onClick={onBack}>←</button>
          <div className="detail-hero-copy">
            <h1 id="detail-title">{record.name}</h1>
            <p id="detail-subtitle">{record.id}</p>
          </div>
        </div>
      </div>
      <div id="detail-tabs" className="detail-tabs" role="tablist" aria-label="Chi tiết">
        {tabs.map((label, i) => <button
          type="button" role="tab" id={"detail-tab-" + i} key={label}
          aria-selected={activeTab === label} aria-controls="detail-body"
          tabIndex={activeTab === label ? 0 : -1}
          data-tab={label} className={"detail-tab " + (activeTab === label ? "selected" : "")}
          onClick={() => setTab(label)}
          onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End"
              ? tabs.length - 1 : (i + (event.key === "ArrowLeft" ? tabs.length - 1 : 1)) % tabs.length;
            setTab(tabs[next]);
            document.getElementById("detail-tab-" + next)?.focus();
          }}
        >{label}</button>)}
      </div>
      <div id="detail-body" className="detail-main v25-full-width" role="tabpanel"
        aria-labelledby={"detail-tab-" + tabs.indexOf(activeTab)}>
        <div className="detail-panel v24-main-panel">
          {activeTab === "Detail"
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
              : activeTab === "Enrollment" && moduleKey === "subscriptions"
                ? <div className="v24-audit-empty" role="status">Phân lớp được quản lý bởi Core. Chức năng xem và thao tác Enrollment thuộc PAP-1035 (S3), chưa triển khai trong S1.</div>
              : activeTab === "Chuyên Sâu"
                ? <BoAdvanced module={module} moduleKey={moduleKey} record={record} />
                : subjectType
                  ? <BoRegistrationHistory key={record.id} subjectType={subjectType} subjectId={record.id} />
                  : <div className="v24-audit-empty" role="status">Lịch sử chưa khả dụng.</div>}
        </div>
      </div>
    </div>
    {voidOpen ? <BoStudentIntakeVoid studentId={record.id}
      onClose={() => setVoidOpen(false)} onNeutralized={onStudentNeutralized!} /> : null}
  </section>;
}

/** Group only fields already present in the authorized projection; no inferred relations. */
function BoAdvanced({ module, moduleKey, record }: { module: BoModule; moduleKey: string; record: BoRecord }) {
  const sections: [string, string[]][] = moduleKey === "students" ? [["Học viên", ["name", "birthYear", "status"]], ["Path", ["paths", "houseMember"]]] : moduleKey === "classes" ? [["Lớp học", ["name", "path", "center"]], ["Lịch học", ["weekday", "window", "capacity", "topology", "status"]]] : moduleKey === "enrollments" ? [["Học viên & lớp học", ["name", "runningClass", "path"]], ["Gói đăng ký", ["subscriptionId"]], ["Thời gian học", ["start", "end", "entry", "duration"]]] : [];
  return sections.length ? <div className="v24-special-grid">{sections.map(([title, keys], i) => <article className={"v24-special-card" + (i === 2 ? " v24-full" : "")} key={title}><div className="v24-card-icon" aria-hidden="true">{["◉", "▦", "◷"][i]}</div><h4>{title}</h4><dl>{keys.map(key => { const field = module.fields.find(f => f.key === key); return field ? <div key={key}><dt>{field.label}</dt><dd><BoValue field={field} value={record[key]} full /></dd></div> : null; })}</dl></article>)}</div> : <div className="v24-audit-empty" role="status">Chưa có thông tin bổ sung.</div>;
}
