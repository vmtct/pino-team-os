"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { detailTabHref, safeBoTableReturn } from "@/lib/bo-full-detail-navigation";

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
  if (designVariant === "v25" && (tabs.length !== 3 || tabs[0].id !== "detail" || tabs[1].id !== "specialized" || tabs[2].id !== "history" || tabs[0].label !== "Detail" || tabs[1].label !== "Chuyên Sâu" || tabs[2].label !== "Lịch Sử")) {
    throw new Error("Invalid BO V2.5 Full Detail tab contract");
  }
  const selected = tabs.find(tab => tab.id === activeTab) ?? tabs[0];
  const tableHref = safeBoTableReturn(returnTo, "/bo");
  return (
    <section aria-label={title} className="bo-full-detail" data-bo-detail-version={designVariant}>
      <nav aria-label="Điều hướng chi tiết">
        <Link href={tableHref}>← Về bảng</Link>
      </nav>
      <header>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {actions}
      </header>
      <div role="tablist" aria-label="Chi tiết">
        {tabs.map(tab => (
          <Link key={tab.id} role="tab" aria-selected={selected.id === tab.id}
            aria-controls={`bo-detail-panel-${tab.id}`}
            id={`bo-detail-tab-${tab.id}`}
            href={detailTabHref(currentUrl, tab.id)}>{tab.label}</Link>
        ))}
      </div>
      <div role="tabpanel" id={`bo-detail-panel-${selected.id}`}
        aria-labelledby={`bo-detail-tab-${selected.id}`} tabIndex={0}>
        {selected.content}
      </div>
    </section>
  );
}
