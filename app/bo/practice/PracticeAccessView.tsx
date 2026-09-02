"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerDirectoryItem } from "@/lib/bo-model";
import type {
  BoPracticeCatalogPath,
  BoPracticeRepertoireAccessGrant,
  BoPracticeRepertoireAccessProjection,
} from "@/lib/bo-practice-model";
import bo from "../bo.module.css";
import styles from "./practice-access.module.css";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

export function PracticeAccessView() {
  const [paths, setPaths] = useState<Load<BoPracticeCatalogPath[]>>({ state: "loading" });
  const [learners, setLearners] = useState<Load<BoLearnerDirectoryItem[]>>({ state: "loading" });
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [pathId, setPathId] = useState("");
  const [projection, setProjection] = useState<Load<BoPracticeRepertoireAccessProjection> | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [grantItemId, setGrantItemId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantUntil, setGrantUntil] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([boApi.practiceRepertoireAccessContext(), boApi.learners("")])
      .then(([context, directory]) => {
        if (!active) return;
        setPaths({ state: "ready", data: context.paths });
        setLearners({ state: "ready", data: directory });
        setPathId(current => current || context.paths[0]?.id || "");
        setStudentId(current => current || directory[0]?.id || "");
      })
      .catch(error => {
        if (!active) return;
        const text = message(error);
        setPaths({ state: "error", message: text });
        setLearners({ state: "error", message: text });
      });
    return () => { active = false; };
  }, []);

  const refreshAccess = useCallback(async (nextStudent = studentId, nextPath = pathId) => {
    setProjection({ state: "loading" });
    try { setProjection({ state: "ready", data: await boApi.practiceRepertoireAccess(nextStudent, nextPath) }); }
    catch (error) { setProjection({ state: "error", message: message(error) }); }
  }, [studentId, pathId]);

  useEffect(() => {
    if (!studentId || !pathId) { setProjection(null); return; }
    void refreshAccess(studentId, pathId);
  }, [studentId, pathId, refreshAccess]);

  async function searchLearners() {
    setLearners({ state: "loading" });
    try {
      const rows = await boApi.learners(query);
      setLearners({ state: "ready", data: rows });
      if (rows.length && !rows.some(row => row.id === studentId)) setStudentId(rows[0]!.id);
    } catch (error) { setLearners({ state: "error", message: message(error) }); }
  }

  const path = paths.state === "ready" ? paths.data.find(item => item.id === pathId) ?? null : null;
  const directory = learners.state === "ready" ? learners.data : [];
  const learner = directory.find(item => item.id === studentId) ?? null;
  const activeByItem = useMemo(() => new Map(
    projection?.state === "ready" ? projection.data.activeGrants.map(grant => [grant.pianoRepertoireItemId, grant]) : [],
  ), [projection]);
  const effectiveByItem = useMemo(() => new Map(
    projection?.state === "ready" ? projection.data.effectiveAccess.map(access => [access.pianoRepertoireItemId, access]) : [],
  ), [projection]);

  async function grantAccess() {
    if (!studentId || !grantItemId || !grantReason.trim()) return;
    setBusy("grant"); setNotice("");
    try {
      await boApi.grantPracticeRepertoireAccess({
        studentProfileId: studentId,
        pianoRepertoireItemId: grantItemId,
        grantReason: grantReason.trim(),
        ...(grantUntil ? { validUntilExclusive: new Date(grantUntil).toISOString() } : {}),
      });
      setGrantItemId(""); setGrantReason(""); setGrantUntil("");
      setNotice("Explicit repertoire access đã được grant. Subscription và learning state không đổi.");
      await refreshAccess();
    } catch (error) { alert(message(error)); }
    finally { setBusy(""); }
  }

  async function revokeAccess(grant: BoPracticeRepertoireAccessGrant) {
    const reason = prompt("Lý do revoke explicit access");
    if (!reason?.trim()) return;
    setBusy(grant.id); setNotice("");
    try {
      await boApi.revokePracticeRepertoireAccess(grant.id, reason.trim());
      setNotice("Explicit repertoire access đã được revoke. Subscription và history vẫn giữ nguyên.");
      await refreshAccess();
    } catch (error) { alert(message(error)); }
    finally { setBusy(""); }
  }
  if (paths.state === "loading" || learners.state === "loading") return <State text="Đang tải learner access control…" />;
  if (paths.state === "error") return <State text={paths.message} error />;
  if (learners.state === "error") return <State text={learners.message} error />;

  return <main className={bo.page}>
    <header className={bo.heading}>
      <span>Back Office · Piano Practice</span>
      <h1>Learner repertoire access</h1>
      <p>Master control cấp hoặc thu explicit access. Không set bài đang học và không sửa Subscription.</p>
    </header>
    {notice ? <div className={bo.successCard}><span>Access updated</span><strong>{notice}</strong></div> : null}
    <section className={styles.accessLayout}>
      <aside className={styles.learnerPane}>
        <form className={styles.searchRow} onSubmit={event => { event.preventDefault(); void searchLearners(); }}>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm learner…" />
          <button className={bo.secondaryButton}>Tìm</button>
        </form>
        <div className={styles.learnerList}>
          {directory.map(item => <button key={item.id} className={studentId === item.id ? styles.learnerActive : styles.learner} onClick={() => { setStudentId(item.id); setNotice(""); }}>
            <strong>{item.displayName}</strong>
            <span>{item.houseMember ? "House Member" : "Pre-member"} · {item.activeSubscriptions} active subscription</span>
            <small>{item.activePaths.map(value => value.displayName).join(" · ") || "Không có active Path"}</small>
          </button>)}
        </div>
      </aside>
      <div className={styles.accessStack}>
        <section className={bo.panel}>
          <div className={bo.panelHeading}><div><h2>{learner?.displayName ?? "Learner"}</h2><p>Explicit grant là một authority riêng; Subscription/Journey vẫn do owning domain quyết định.</p></div><span className={bo.writePill}>Permission</span></div>
          <label className={styles.field}>Path<select value={pathId} onChange={event => { setPathId(event.target.value); setGrantItemId(""); }}>
            {paths.data.map(item => <option value={item.id} key={item.id}>{item.displayName}</option>)}
          </select></label>
          <div className={styles.authorityNote}>
            <strong>{learner?.activePaths.some(item => item.id === pathId) ? "Subscription path đang active" : "Không có active Subscription cho Path này"}</strong>
            <span>Điều này không khóa authorized Staff khỏi explicit grant nếu permission cho phép.</span>
          </div>
        </section>
        <section className={bo.panel}>
          <div className={bo.panelHeading}><div><h2>Grant explicit repertoire access</h2><p>Chỉ published repertoire trong Path mà Staff có quyền manage mới xuất hiện.</p></div><span className={bo.writePill}>Write</span></div>
          <div className={styles.grantForm}>
            <label className={styles.field}>Repertoire<select value={grantItemId} onChange={event => setGrantItemId(event.target.value)}>
              <option value="">Chọn repertoire…</option>
              {(path?.repertoireItems ?? []).filter(item => !activeByItem.has(item.id)).map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
            </select></label>
            <label className={styles.field}>Reason<input value={grantReason} onChange={event => setGrantReason(event.target.value)} placeholder="Ví dụ: mở thêm bài luyện theo quyết định học thuật" /></label>
            <label className={styles.field}>Expiry (optional)<input type="datetime-local" value={grantUntil} onChange={event => setGrantUntil(event.target.value)} /></label>
            <button className={bo.primaryButton} disabled={!grantItemId || !grantReason.trim() || busy === "grant"} onClick={() => void grantAccess()}>{busy === "grant" ? "Đang grant…" : "Grant access"}</button>
          </div>
        </section>
        <section className={bo.panel}>
          <div className={bo.panelHeading}><div><h2>Published repertoire</h2><p>Effective access do Core resolve từ Subscription, specialty, preview và explicit grant; không phải learning progress.</p></div><span className={bo.readOnly}>Effective at now</span></div>
          {projection?.state === "loading" ? <State text="Đang resolve grants…" /> : projection?.state === "error" ? <State text={projection.message} error /> : <div className={styles.repertoireList}>
            {(path?.repertoireItems ?? []).map(item => {
              const grant = activeByItem.get(item.id);
              const effective = effectiveByItem.get(item.id);
              return <article className={styles.repertoireRow} key={item.id}>
                <div className={styles.repertoireCopy}>
                  <div className={styles.repertoireTitle}><strong>{item.title}</strong><span className={styles.effectivePill} data-state={effective?.state ?? "UNRESOLVED"}>{effective?.state ?? "UNRESOLVED"}</span></div>
                  <span>{item.repertoireClass} · {item.code} · {effective ? accessSource(effective.authorityReasons) : "Effective access unavailable"}</span>
                  <small>Viewer {effective?.capabilities.OPEN_VIEWER ?? "—"} · Left-hand guidance {effective?.capabilities.LEFT_HAND_GUIDANCE ?? "—"}{effective?.recommendedAction !== "NONE" ? ` · ${effective?.recommendedAction}` : ""}</small>
                  <small>{grant ? `Explicit grant ${short(grant.validFrom)}${grant.validUntilExclusive ? ` → ${short(grant.validUntilExclusive)}` : " · không expiry"}` : "Không có explicit grant active"}</small>
                </div>
                {grant ? <button className={bo.secondaryButton} disabled={busy === grant.id} onClick={() => void revokeAccess(grant)}>{busy === grant.id ? "Đang revoke…" : "Revoke"}</button> : <button className={bo.secondaryButton} onClick={() => setGrantItemId(item.id)}>Grant</button>}
              </article>;
            })}
          </div>}
        </section>
        <section className={bo.panel}>
          <div className={bo.panelHeading}><div><h2>Grant history</h2><p>Durable provenance; revoke không xóa history.</p></div><span className={bo.readOnly}>Read</span></div>
          {projection?.state === "ready" && projection.data.history.length ? <div className={bo.tableWrap}><table><thead><tr><th>Repertoire</th><th>Grant</th><th>Validity</th><th>Status</th></tr></thead><tbody>
            {[...projection.data.history].reverse().map(grant => <tr key={grant.id}>
              <td>{path?.repertoireItems.find(item => item.id === grant.pianoRepertoireItemId)?.title ?? grant.pianoRepertoireItemId}</td>
              <td>{grant.grantReason}<small>{grant.grantedByUserId}</small></td>
              <td>{short(grant.validFrom)} → {grant.validUntilExclusive ? short(grant.validUntilExclusive) : "open"}</td>
              <td>{grant.revokedAt ? `REVOKED · ${grant.revokeReason ?? "—"}` : activeByItem.has(grant.pianoRepertoireItemId) ? "ACTIVE" : "INACTIVE"}</td>
            </tr>)}
          </tbody></table></div> : <p className={bo.muted}>Chưa có explicit repertoire grant trong Path này.</p>}
        </section>
      </div>
    </section>
  </main>;
}
function State({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`${bo.state} ${error ? bo.errorState : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>;
}

function accessSource(reasons: string[]) {
  if (reasons.includes("REPERTOIRE_ACCESS_GRANT")) return "Explicit repertoire grant";
  if (reasons.includes("SPECIALTY_ENTITLEMENT")) return reasons.includes("ACTIVE_PATH_SUBSCRIPTION") ? "Specialty + Subscription" : "Specialty entitlement";
  if (reasons.includes("ACTIVE_PATH_SUBSCRIPTION")) return "Subscription";
  if (reasons.includes("PREMIUM_ACCESS_GRANT")) return "Premium grant";
  if (reasons.includes("TARGETED_PREVIEW")) return "Targeted preview";
  if (reasons.includes("HOUSE_BASELINE")) return "House baseline";
  if (reasons.includes("NO_HOUSE_MEMBERSHIP")) return "No House membership";
  if (reasons.includes("LOCKED_SPECIALTY")) return "Specialty locked";
  if (reasons.includes("LOCKED_PREMIUM")) return "Premium locked";
  return "Canonical access rule";
}
function short(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function message(error: unknown) {
  return error instanceof BoApiError
    ? `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`
    : error instanceof Error ? error.message : "Access command failed.";
}
