"use client";
import { useMemo, useState } from "react";
import {
  describeTosMissionLocks,
  filterTosScopedMissions,
  validateTosScopedMissionChoices,
  type TosMissionAvailabilityFilter,
  type TosScopedMissionChoice,
} from "@/lib/tos-specialty-mission-availability";
import styles from "./classroom.module.css";

/** PAP-1497 / SPEC-UNLOCK. Display-only TOS selector for a VERIFIED Core /eligible response.
 * The owner of Mission Assignment/Diary must recheck the Core policy on write.
 */
export function TosSpecialtyMissionChoiceList({
  items, studentName, onSelect, disabled = false,
}: {
  items: unknown;
  studentName: string;
  onSelect: (missionId: string) => void;
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState<TosMissionAvailabilityFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const state = useMemo(() => {
    try { return { data: validateTosScopedMissionChoices(items) as TosScopedMissionChoice[], error: "" }; }
    catch { return { data: [] as TosScopedMissionChoice[], error: "Chưa tải được quyền chọn Nhiệm Vụ. Vui lòng thử lại." }; }
  }, [items]);
  const shown = useMemo(() => filterTosScopedMissions(state.data, filter, query),
    [state.data, filter, query]);
  return <section className={styles.rosterSection} aria-label={"Nhiệm vụ của " + studentName}>
    <header className={styles.sectionTitle}>
      <h3>Chọn Nhiệm Vụ · {studentName}</h3>
      <b aria-label={state.data.length + " nhiệm vụ"}>{state.data.length}</b>
    </header>
    {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : <>
      <div className={styles.toolbar}>
        <label htmlFor="tos-specialty-mission-query">Tìm nhiệm vụ
          <input id="tos-specialty-mission-query" type="search" value={query}
            onChange={event => setQuery(event.target.value)} placeholder="Tên hoặc mã nhiệm vụ" />
        </label>
        <label htmlFor="tos-specialty-mission-filter">Hiển thị
          <select id="tos-specialty-mission-filter" value={filter}
            onChange={event => setFilter(event.target.value as TosMissionAvailabilityFilter)}>
            <option value="all">Tất cả</option>
            <option value="available">Có thể chọn</option>
            <option value="locked">Đang khóa</option>
          </select>
        </label>
      </div>
      {!shown.length ? <p role="status" className={styles.empty}>Không có nhiệm vụ phù hợp.</p> : null}
      {shown.map(item => <article key={item.missionId}
        className={item.available ? styles.readyCard : styles.blockedCard}>
        <div className={styles.sectionTitle}>
          <div><strong>{item.code} · {item.name}</strong>
            <small> · Cấp {item.level}</small></div>
          <span>{item.available ? "Có thể chọn" : "Đang khóa"}</span>
        </div>
        {!item.available ? <>
          <button type="button" className={styles.visitButton}
            aria-expanded={expanded === item.missionId}
            onClick={() => setExpanded(current => current === item.missionId ? null : item.missionId)}>
            {expanded === item.missionId ? "Ẩn lý do khóa" : "Xem lý do khóa"}
          </button>
          {expanded === item.missionId ?
            <ul aria-label={"Lý do khóa " + item.code}>
              {describeTosMissionLocks(item).map((reason, index) => <li key={index}>{reason}</li>)}
            </ul> : null}
        </> : null}
        <button type="button" className={styles.presentButton}
          disabled={!item.available || disabled}
          aria-label={item.available ? "Chọn " + item.code : item.code + " chưa đủ điều kiện"}
          onClick={() => { if (item.available && !disabled) onSelect(item.missionId); }}>
          {item.available ? "Chọn nhiệm vụ" : "Chưa thể chọn"}
        </button>
      </article>)}
    </>}
  </section>;
}
