"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../policies.module.css";
import {
  currentWorkforcePolicies,
  historicalWorkforcePolicies,
  upcomingWorkforcePolicies,
  type PolicyPrototype,
} from "@/lib/policy-center-prototype";

type View = "CURRENT" | "UPCOMING" | "HISTORY";

const views: Array<{ id: View; label: string; count: number }> = [
  { id: "CURRENT", label: "Current", count: currentWorkforcePolicies.length },
  { id: "UPCOMING", label: "Upcoming", count: upcomingWorkforcePolicies.length },
  { id: "HISTORY", label: "History", count: historicalWorkforcePolicies.length },
];

function statusClass(status: PolicyPrototype["status"]) {
  if (status === "ACTIVE") return styles.active;
  if (status === "SCHEDULED") return styles.scheduled;
  return styles.superseded;
}

function PolicyRows({ items }: { items: PolicyPrototype[] }) {
  if (items.length === 0) return <div className={styles.empty}>No policies in this state.</div>;

  return <div className={styles.policyList}>
    {items.map(policy => {
      const isEveningShift = policy.name === "Evening Assistant Shift";
      return <article className={styles.policyRow} key={policy.id}>
        <div>
          <h3>{policy.name}</h3>
          <p>{policy.summary}</p>
          <div className={styles.meta}>
            <span className={styles.tag}>{policy.target}</span>
            <span>Used by {policy.usedBy.join(" · ")}</span>
          </div>
        </div>
        <div className={styles.policyRight}>
          <span className={`${styles.badge} ${statusClass(policy.status)}`}>{policy.status}</span>
          <strong>v{policy.version}</strong>
          <span>{policy.effectiveFrom}</span>
          {isEveningShift ? <Link className={styles.buttonGhost} style={{marginTop:8}} href="/founder/policies/workforce/evening-shift">View stream</Link> : null}
        </div>
      </article>;
    })}
  </div>;
}

export function WorkforcePolicyBrowser() {
  const [view, setView] = useState<View>("CURRENT");
  const items = view === "CURRENT"
    ? currentWorkforcePolicies
    : view === "UPCOMING"
      ? upcomingWorkforcePolicies
      : historicalWorkforcePolicies;

  const description = view === "CURRENT"
    ? "Policies governing new operating decisions right now."
    : view === "UPCOMING"
      ? "Future-effective versions that are already scheduled and visible before activation."
      : "Superseded versions retained as historical truth; they are never overwritten in place.";

  return <section className={styles.panel}>
    <div className={styles.panelHeader}>
      <div>
        <h2>Policy states</h2>
        <p>{description}</p>
      </div>
    </div>

    <div className={styles.policyTabs} role="tablist" aria-label="Workforce policy states">
      {views.map(item => <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={view === item.id}
        className={`${styles.policyTab} ${view === item.id ? styles.policyTabActive : ""}`}
        onClick={() => setView(item.id)}
      >
        {item.label}<span>{item.count}</span>
      </button>)}
    </div>

    <PolicyRows items={items}/>
  </section>;
}
