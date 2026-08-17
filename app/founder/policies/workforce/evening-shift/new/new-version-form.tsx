"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "../../../policies.module.css";

const base = {
  version: 4,
  start: "17:00",
  end: "21:00",
  split: "NO",
  effectiveFrom: "01 Sep 2026",
};

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function NewEveningShiftVersionForm() {
  const [start, setStart] = useState(base.start);
  const [end, setEnd] = useState(base.end);
  const [split, setSplit] = useState(base.split);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");

  const changed = start !== base.start || end !== base.end || split !== base.split;
  const coverageDelta = useMemo(() => {
    const baseStart = toMinutes(base.start);
    const baseEnd = toMinutes(base.end);
    const draftStart = toMinutes(start);
    const draftEnd = toMinutes(end);
    if ([baseStart, baseEnd, draftStart, draftEnd].some(value => value === null)) return null;
    return (draftEnd! - draftStart!) - (baseEnd! - baseStart!);
  }, [start, end]);

  const deltaText = coverageDelta === null
    ? "Enter valid HH:MM times to preview the coverage-window delta."
    : coverageDelta === 0
      ? "No coverage-window duration change yet."
      : coverageDelta > 0
        ? `Projected +${coverageDelta} minutes of PA coverage per affected operating day.`
        : `Projected ${coverageDelta} minutes of PA coverage per affected operating day.`;

  return <>
    <section className={styles.workspace}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Draft v5</h2>
            <p>Based on already-scheduled v4. Editor is domain-specific; this prototype never writes to Core.</p>
          </div>
          <span className={`${styles.badge} ${styles.prototype}`}>INTERACTIVE MOCK</span>
        </div>

        <div className={styles.notice}>
          <strong>Why v5?</strong> v4 is already scheduled for {base.effectiveFrom}. A new draft therefore demonstrates the next-version flow without overwriting or pretending v4 is still a draft.
        </div>

        <div className={`${styles.form} ${styles.sectionGap}`}>
          <div className={styles.field}>
            <label htmlFor="policy-start">Start time</label>
            <input id="policy-start" type="time" value={start} onChange={event => setStart(event.target.value)}/>
          </div>
          <div className={styles.field}>
            <label htmlFor="policy-end">End time</label>
            <input id="policy-end" type="time" value={end} onChange={event => setEnd(event.target.value)}/>
          </div>
          <div className={styles.field}>
            <label htmlFor="policy-split">Split shift</label>
            <select id="policy-split" value={split} onChange={event => setSplit(event.target.value)}>
              <option value="NO">No</option>
              <option value="YES">Yes</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="policy-effective">Effective from</label>
            <input id="policy-effective" type="date" value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)}/>
            <span className={styles.hint}>Leave blank while exploring the draft; scheduling would require a future effective date in runtime.</span>
          </div>
          <div className={styles.field}>
            <label htmlFor="policy-reason">Change reason</label>
            <textarea id="policy-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Why should PINO change this policy?"/>
            <span className={styles.hint}>Material policy changes retain a reason/change note for provenance.</span>
          </div>
        </div>

        <div className={styles.footerActions}>
          <Link className={styles.buttonGhost} href="/founder/policies/workforce/evening-shift">Cancel</Link>
          <span className={styles.buttonDisabled}>Schedule version · prototype only</span>
        </div>
      </div>

      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Change review</h2><p>Comparison updates as you edit so Founder reviews the decision, not raw storage.</p></div>
        </div>
        <div className={styles.compare}>
          <div className={styles.compareCard}>
            <span>Scheduled v4</span>
            <strong>{base.start} → {base.end}</strong>
            <span>{base.split === "NO" ? "No split" : "Split allowed"} · effective {base.effectiveFrom}</span>
          </div>
          <div className={styles.arrow}>→</div>
          <div className={`${styles.compareCard} ${changed ? styles.compareChanged : ""}`}>
            <span>Draft v5</span>
            <strong>{start || "—"} → {end || "—"}</strong>
            <span>{split === "NO" ? "No split" : "Split allowed"}{effectiveFrom ? ` · effective ${effectiveFrom}` : " · effective date not set"}</span>
          </div>
        </div>
        <div className={`${styles.notice} ${styles.sectionGap}`}>
          <strong>Historical safety:</strong> v2/v3 history and already-published schedules remain unchanged. v4 also remains the scheduled future version unless a separate approved lifecycle action changes it.
        </div>
      </aside>
    </section>

    <section className={`${styles.panel} ${styles.sectionGap}`}>
      <div className={styles.panelHeader}>
        <div><h2>Impact Preview</h2><p>Interactive mock of Workforce.previewPolicyChange(...). Advisory only; no effects are committed.</p></div>
        <span className={`${styles.badge} ${styles.prototype}`}>MOCK DOMAIN PREVIEW</span>
      </div>
      <div className={styles.impact}>
        <div className={styles.impactRow}><strong>Policy value</strong><span>{changed ? "Draft differs from scheduled v4 and would require review before scheduling." : "No policy value change yet; edit the fields above to explore impact."}</span></div>
        <div className={styles.impactRow}><strong>Coverage window</strong><span>{deltaText}</span></div>
        <div className={styles.impactRow}><strong>Future Shift Offerings</strong><span>{changed ? "Unpublished offerings after the chosen effective time may resolve against the new version." : "No projected change while the draft matches v4."}</span></div>
        <div className={styles.impactRow}><strong>Published schedules</strong><span>No automatic change. Published cycles retain the policy/version that governed their publish decision.</span></div>
        <div className={styles.impactRow}><strong>Historical records</strong><span>Unchanged. Prior versions remain historical truth for their effective periods.</span></div>
      </div>
    </section>
  </>;
}
