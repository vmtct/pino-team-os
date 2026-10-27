"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { detailTabHref, safeBoTableReturn } from "@/lib/bo-full-detail-navigation";
import styles from "./BoFullDetail.module.css";

export type BoFullDetailTab = { id: string; label: string; content: ReactNode };
export type BoFullDetailProps = {
  title: string;
  description?: string;
  currentUrl: string;
  returnTo?: string | null;
  tabs: readonly BoFullDetailTab[];
  activeTab?: string | null;
  actions?: ReactNode;
  designVariant?: "v25";
};

/** PAP-882 shared, domain-neutral Full Detail; domain owns data and ACL. */
export function BoFullDetail({ title, description, currentUrl, returnTo, tabs, activeTab, actions, designVariant }: BoFullDetailProps) {
  const unique = new Set(tabs.map(tab => tab.id));
  if (!tabs.length || unique.size !== tabs.length || tabs.some(tab => !/^[a-z][a-z0-9-]{0,63}$/.test(tab.id))) {
    throw new Error("Invalid BO detail tabs");
  }
  // V2.5 retains the three mandatory domain-neutral tabs, while allowing a module
  // to insert a named relation tab (e.g. Student → Subscriptions) without forking the shell.
  const canonical = tabs.filter(tab => ["detail", "specialized", "history"].includes(tab.id));
  if (designVariant === "v25" && (canonical.length !== 3 || canonical[0].id !== "detail" || canonical[1].id !== "specialized" || canonical[2].id !== "history" || canonical[0].label !== "Detail" || canonical[1].label !== "Chuyên Sâu" || canonical[2].label !== "Lịch Sử")) {
    throw new Error("Invalid BO V2.5 Full Detail tab contract");
  }
  const selected = tabs.find(tab => tab.id === activeTab) ?? tabs[0];
  const tableHref = safeBoTableReturn(returnTo, "/bo");
  return (
    <section aria-label={title} className={`bo-full-detail ${designVariant === "v25" ? styles.root : ""}`} data-bo-detail-version={designVariant}>
      <nav className={designVariant === "v25" ? styles.breadcrumb : undefined} aria-label="Điều hướng chi tiết">
        <Link href={tableHref}>← Về bảng</Link>
      </nav>
      <div className={designVariant === "v25" ? styles.cover : undefined}>
      <header className={designVariant === "v25" ? styles.hero : undefined}>
        <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className={designVariant === "v25" ? styles.tabs : undefined} role="tablist" aria-label="Chi tiết">
        {tabs.map(tab => (
          <Link key={tab.id} role="tab" aria-selected={selected.id === tab.id}
            aria-controls={`bo-detail-panel-${tab.id}`}
            id={`bo-detail-tab-${tab.id}`}
            href={detailTabHref(currentUrl, tab.id)}>{tab.label}</Link>
        ))}
      </div>
      <div className={designVariant === "v25" ? styles.body : undefined}>
      <div className={designVariant === "v25" ? styles.panel : undefined} role="tabpanel" id={`bo-detail-panel-${selected.id}`}
        aria-labelledby={`bo-detail-tab-${selected.id}`} tabIndex={0}>
        {designVariant === "v25" ? <h2 className={styles.panelTitle}>{selected.label}</h2> : null}
        {selected.content}
      </div>
      </div>
      </div>
    </section>
  );
}
