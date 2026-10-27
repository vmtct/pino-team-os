"use client";
import { useState, type KeyboardEvent } from "react";
import { BoValue } from "./BoValue";
import type { BoModule, BoRecord } from "@/lib/bo-registration";

/**
 * PAP-1029: UI-only, read-only tabs inside the existing BO V2.5 Drawer/Detail.
 * Unavailable relationship/contact/audit data must never be invented or
 * derived from the legacy, raw-PII 25-result identity/parents intake search.
 */
const tabs = ["Overview", "Students", "Contacts", "Audit"] as const;
type ParentTab = (typeof tabs)[number];

export function BoParentReadTabs({ module, record }: { module: BoModule; record: BoRecord }) {
  const [tab, setTab] = useState<ParentTab>("Overview");
  function keydown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  return <section aria-label="Parents & Guardians">
    <div className="detail-tabs" role="tablist" aria-label="Parent">
      {tabs.map((item, index) => <button type="button" role="tab" key={item} id={"parent-tab-" + item.toLowerCase()}
        aria-selected={item === tab} aria-controls="parent-tab-panel" tabIndex={item === tab ? 0 : -1}
        className={"detail-tab" + (item === tab ? " selected" : "")}
        onClick={() => setTab(item)} onKeyDown={(event) => keydown(event, index)}>{item}</button>)}
    </div>
    <section id="parent-tab-panel" role="tabpanel" aria-labelledby={"parent-tab-" + tab.toLowerCase()} className="v24-prop-section">
      {tab === "Overview"
        ? <div className="v24-prop-grid">{module.fields.map(field => <div className="v24-prop-item" key={field.key}>
            <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}</div>
            <div className="v24-prop-value readonly" aria-label={"Chỉ đọc " + field.label}><BoValue field={field} value={record[field.key]} full /></div>
          </div>)}</div>
        : <div className="v24-audit-empty" role="status">
            {tab === "Students" ? "Danh sách liên kết Student hiện tại cần Core Parent Directory được cấp quyền."
              : tab === "Contacts" ? "Thông tin liên hệ chỉ hiển thị khi Core cung cấp dữ liệu đã che và kiểm tra quyền."
              : "Audit chỉ hiển thị các sự kiện đã được Core cho phép và ẩn dữ liệu nhạy cảm."}
          </div>}
    </section>
  </section>;
}
