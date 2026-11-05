"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { nextTabIndex, returnToTable } from "./navigation";

export type DetailTab = { readonly id: string; readonly label: string; readonly href?: string };
/** Only compatibility adapters may select the pre-existing Factory CSS profile. */
export type LegacyDetailProfile = { readonly root?: string; readonly breadcrumb?: string; readonly cover?: string; readonly hero?: string; readonly tabs?: string; readonly body?: string; readonly panel?: string; readonly panelTitle?: string; readonly version?: "v25" };
export type DetailFrameProps = {
  readonly title: string; readonly subtitle?: string; readonly mobileMenu?: ReactNode;
  readonly tabs?: readonly DetailTab[]; readonly selected?: string; readonly onSelect?: (id: string) => void;
  readonly onBack?: () => void; readonly backHref?: string; readonly actions?: ReactNode;
  readonly children: ReactNode; readonly after?: ReactNode; readonly legacyContent?: ReactNode;
  readonly legacyProfile?: LegacyDetailProfile; readonly returnFocus?: () => HTMLElement | null;
};
/** Sole cover/hero/tablist/body owner for typed TDD and both legacy Detail adapters. */
export function DetailFrame({ title, subtitle, mobileMenu, tabs = [], selected, onSelect, onBack, backHref, actions, children, after, legacyContent, legacyProfile: p, returnFocus }: DetailFrameProps) {
  const active = tabs.find(t => t.id === selected) ?? tabs[0];
  if (new Set(tabs.map(t => t.id)).size !== tabs.length) throw Error("Duplicate Detail tabs");
  const tabId = (id: string) => p ? `bo-detail-tab-${id}` : `detail-tab-${tabs.findIndex(t => t.id === id)}`;
  const panelId = p ? `bo-detail-panel-${active?.id}` : "detail-body";
  const Hero = p ? "header" : "div";
  const identity = <><h1 id={p ? undefined : "detail-title"}>{title}</h1>{subtitle ? <p id={p ? undefined : "detail-subtitle"}>{subtitle}</p> : null}</>;
  return <section id={p ? undefined : "detail-screen"} aria-label={title} className={p ? `bo-full-detail ${p.root ?? ""}` : undefined} data-bo-detail-version={p?.version} data-tdd-shell="detail">
    {p && backHref ? <nav className={p.breadcrumb} aria-label="Điều hướng chi tiết"><Link href={backHref}>← Về bảng</Link></nav> : null}
    <div className={p ? p.cover : "detail-cover"}>
      <Hero className={p ? p.hero : "detail-hero"}>
        {p ? <div>{identity}</div> : <div className="detail-hero-primary">
          {mobileMenu}
          {!p ? <button type="button" id="back-to-list" className="detail-hero-back" title="Quay lại bảng" aria-label="Quay lại bảng" onClick={() => { onBack?.(); if (returnFocus) requestAnimationFrame(() => returnToTable(() => {}, returnFocus())); }}>←</button> : null}
          <div className="detail-hero-copy">{identity}</div>
        </div>}{actions}
      </Hero>
      {legacyContent ?? <>
        <div id={p ? undefined : "detail-tabs"} className={p ? p.tabs : "detail-tabs"} role="tablist" aria-label="Chi tiết">
          {tabs.map((tab, index) => {
            const props = {
              role: "tab", id: tabId(tab.id), "aria-selected": active?.id === tab.id,
              "aria-controls": panelId, tabIndex: active?.id === tab.id ? 0 : -1,
              onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
                const next = nextTabIndex(event.key, index, tabs.length); if (next === null) return;
                event.preventDefault();
                if (tabs[next].href) (document.getElementById(tabId(tabs[next].id)) as HTMLElement | null)?.click();
                else onSelect?.(tabs[next].id);
                document.getElementById(tabId(tabs[next].id))?.focus();
              },
            };
            return tab.href ? <Link key={tab.id} {...props} href={tab.href}>{tab.label}</Link> : <button key={tab.id} {...props} type="button" data-tab={tab.id} className={"detail-tab " + (active?.id === tab.id ? "selected" : "")} onClick={() => onSelect?.(tab.id)}>{tab.label}</button>;
          })}
        </div>
        {p ? <div className={p.body}><div id={panelId} className={p.panel} role="tabpanel" aria-labelledby={active ? tabId(active.id) : undefined} tabIndex={0}>{p.panelTitle ? <h2 className={p.panelTitle}>{active?.label}</h2> : null}{children}</div></div>
          : <div id="detail-body" className="detail-main v25-full-width" role="tabpanel" aria-labelledby={active ? tabId(active.id) : undefined} tabIndex={0}><div className="detail-panel v24-main-panel">{children}</div></div>}
      </>}
    </div>{after}
  </section>;
}
