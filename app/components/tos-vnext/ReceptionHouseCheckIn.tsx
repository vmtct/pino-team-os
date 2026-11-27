"use client";
/** PAP-1239 — CP1 real House check-in, without creating a shadow attendance model. */
import { useEffect, useRef, useState } from "react";
import { TosVNextButton, TosVNextCard, TosVNextStatus } from "../tos-ds";
import {
  ReceptionHouseError, tosReceptionHouseApi, type ReceptionLearner,
} from "@/lib/tos-reception-house-api";
import {TosWishRuntime} from "./TosWishRuntime";
import styles from "./reception-house.module.css";

type Intent = { learnerId: string; centerId: string; key: string; checkedInAt: string };

/** PAP-2131: optional read-only recent learner port; Core integration is a separate gate. */
export function ReceptionHouseCheckIn({ centerId, loadRecentLearners, onVisitChanged, onWishCommitted, visitRevision=0, activeVisitIds }: {
  centerId: string;
  onVisitChanged?: () => void;
  onWishCommitted?: () => void;
  visitRevision?: number;
  activeVisitIds?: Readonly<Record<string,string>>;
  loadRecentLearners?: (centerId: string, signal: AbortSignal) => Promise<ReceptionLearner[]>;
}) {
  const [query, setQuery] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const searchArea = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!optionsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchArea.current?.contains(event.target)) setOptionsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [optionsOpen]);
  const [learners, setLearners] = useState<ReceptionLearner[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const intent = useRef<Intent | null>(null);

  useEffect(() => {
    const term = query.trim();
    const recent = term.length === 0 && Boolean(loadRecentLearners);
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      if (!centerId || (!recent && term.length < 2)) { setLoading(false); return; }
      setLoading(true);
      try {
        const results = recent && loadRecentLearners
          ? (await loadRecentLearners(centerId, controller.signal)).filter((row, i, all) => all.findIndex(other => other.studentProfileId === row.studentProfileId) === i).slice(0, 3)
          : await tosReceptionHouseApi.search(centerId, term, controller.signal);
        if (!controller.signal.aborted) {
          setLearners(results);
          setSelectedId(current => results.some(row => row.studentProfileId === current) ? current : null);
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setLearners([]); setSelectedId(null);
          setError(reason instanceof ReceptionHouseError && reason.status === 403
            ? "Tài khoản chưa có quyền đón học viên tại trung tâm này."
            : reason instanceof Error ? reason.message : "Không thể tải học viên từ Core.");
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, recent || refresh ? 0 : 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [centerId, query, refresh, loadRecentLearners, visitRevision]);

  const selected = learners.find(row => row.studentProfileId === selectedId);
  const wishVisit=selected?.openVisit&&activeVisitIds?.[selected.studentProfileId]===selected.openVisit.id?selected.openVisit:null;
  function choose(learner: ReceptionLearner) {
    setSelectedId(learner.studentProfileId); setOptionsOpen(false);
    setNotice(""); setError(""); intent.current = null;
  }
  async function checkIn() {
    if (!selected || selected.openVisit || submitting || !centerId) return;
    const current = intent.current?.learnerId === selected.studentProfileId
      && intent.current.centerId === centerId ? intent.current : {
        learnerId: selected.studentProfileId,
        centerId,
        key: crypto.randomUUID(),
        checkedInAt: new Date().toISOString(),
      };
    intent.current = current;
    setSubmitting(true); setError(""); setNotice("");
    try {
      const confirmed = await tosReceptionHouseApi.checkIn({
        centerId, studentProfileId: current.learnerId, checkedInAt: current.checkedInAt,
      }, current.key);
      setLearners(rows => rows.map(row => row.studentProfileId === current.learnerId
        ? { ...row, openVisit: { id: confirmed.visit.id, checkedInAt: confirmed.visit.checkedInAt, version: confirmed.visit.version } }
        : row));
      intent.current = null;
      setNotice("Check-in đã được Core xác nhận. Học viên đang ở PINO House.");
      setRefresh(value => value + 1);
    } catch (reason) {
      if (reason instanceof ReceptionHouseError && reason.status === 409) {
        intent.current = null;
        setError("Trạng thái học viên đã thay đổi. Kiểm tra lại lượt đến trước khi thao tác.");
      } else {
        // Unknown outcome: preserve key + timestamp. Never generate a second command on blind retry.
        setError(reason instanceof ReceptionHouseError && reason.status === 403
          ? "Không có quyền xác nhận học viên tại trung tâm này."
          : "Chưa xác minh được kết quả check-in. Tải lại trạng thái trước khi thử tiếp.");
      }
      setRefresh(value => value + 1);
    } finally { setSubmitting(false); onVisitChanged?.(); }
  }

  return <><TosVNextCard className={styles.panel} aria-label="Check-in học viên PINO House">
    <div className={styles.heading}>
      <strong>Check-in học viên</strong>

    </div>

    <div ref={searchArea} className={styles.searchArea}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOptionsOpen(false); }}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); searchInput.current?.focus(); setOptionsOpen(false); } }}>
      <input ref={searchInput} className={styles.searchInput} type="search" value={query} autoComplete="off"
        placeholder="Tìm Học Viên" aria-label="Tìm Học Viên" aria-controls={optionsOpen && learners.length > 0 ? "reception-learner-options" : undefined}
        onFocus={() => setOptionsOpen(true)} onClick={() => setOptionsOpen(true)}
        onChange={event => { const value = event.target.value; setQuery(value); setOptionsOpen(true); setError(""); setNotice(""); intent.current = null; setLearners([]); setSelectedId(null); setLoading(false); }}
        />


    {optionsOpen && (query.trim().length >= 2 || (!query.trim() && loadRecentLearners)) && (loading || query.trim().length >= 2) &&
      <div className={styles.summary}><span aria-live="polite">{loading ? "Đang tải…" : `${learners.length} học viên`}</span></div>}
    {optionsOpen && learners.length > 0 && <div id="reception-learner-options" role="group" className={styles.list} aria-label={!query.trim() && loadRecentLearners ? "Học viên check-in gần đây" : "Học viên tìm thấy"}>
      {learners.map(learner => <button type="button" key={learner.studentProfileId}
        className={styles.row} aria-pressed={learner.studentProfileId === selectedId}
        onClick={() => choose(learner)} disabled={submitting}>
        <span className={styles.avatar} aria-hidden="true">{learner.displayName.slice(0, 1)}</span>
        <span className={styles.identity}><strong>{learner.displayName}</strong>
          <small>{learner.openVisit ? "Đang ở House" : "Chưa check-in"}</small></span>
        <span className={styles.chooser}>{learner.studentProfileId === selectedId ? "Đã chọn" : "Chọn"}</span>
      </button>)}
    </div>}
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    {selected && <div className={styles.confirm}>
      <div className={styles.selected}><span>Học viên được chọn</span><strong>{selected.displayName}</strong></div>
      {selected.openVisit
        ? <><TosVNextStatus>Đang ở House</TosVNextStatus>
          <p className={styles.hint}>Đã đến lúc {new Date(selected.openVisit.checkedInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}. Không tạo thêm StudentVisit.</p></>
        : <><p className={styles.help}>Chỉ xác nhận khi học viên đã có mặt tại quầy.</p>
          <TosVNextButton type="button" onClick={() => void checkIn()} disabled={submitting || loading}>
            {submitting ? "Đang xác nhận…" : "Xác nhận đã đến"}
          </TosVNextButton></>}
    </div>}
  </TosVNextCard>{selected && wishVisit && <TosWishRuntime key={wishVisit.id} centerId={centerId} learnerId={selected.studentProfileId} legalName={selected.displayName} gender={null} onCommitted={onWishCommitted}/>}</>;
}
