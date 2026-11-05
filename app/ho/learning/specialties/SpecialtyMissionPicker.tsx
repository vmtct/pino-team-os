"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  searchLinkableSpecialtyMissions,
  type SpecialtyMissionOption,
} from "@/lib/specialty-mission-picker";
import styles from "./SpecialtyMissionPicker.module.css";

export interface SpecialtyMissionPickerProps {
  missions: readonly SpecialtyMissionOption[];
  pathProgramId: string;
  linkedMissionIds: ReadonlySet<string>;
  value: SpecialtyMissionOption | null;
  onChange: (selected: SpecialtyMissionOption | null) => void;
  disabled?: boolean;
}

/** PAP-1495: approved HO relation search; parent performs the Core link command. */
export function SpecialtyMissionPicker({
  missions, pathProgramId, linkedMissionIds, value, onChange, disabled = false,
}: SpecialtyMissionPickerProps) {
  const id = useId().replace(/:/g, "");
  const inputId = id + "-mission-search";
  const listId = id + "-mission-results";
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const field = useRef<HTMLDivElement>(null);
  const results = useMemo(() =>
    searchLinkableSpecialtyMissions(missions, pathProgramId, linkedMissionIds, text),
    [missions, pathProgramId, linkedMissionIds, text]);
  const previousSelection = useRef<SpecialtyMissionOption | null>(null);
  useEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = value;
    if (value) {
      setText(value.code + " · " + value.name);
      setOpen(false);
      setActive(0);
    } else if (previous) {
      // Explicit clear after a successful link resets the picker. If the user
      // typed a new query over the selected value, preserve that new query.
      const label = previous.code + " · " + previous.name;
      setText(current => current === label ? "" : current);
    }
  }, [value]);
  const matches = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().length >= 2;
  const visible = open && !value && matches && !disabled;
  const choose = (mission: SpecialtyMissionOption) => {
    onChange(mission);
    setText(mission.code + " · " + mission.name);
    setOpen(false);
    setActive(0);
  };
  return <div className={styles.field} ref={field} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label htmlFor={inputId}>Nhiệm vụ</label>
    <input id={inputId} type="search" role="combobox" autoComplete="off"
      className={styles.input} disabled={disabled}
      aria-haspopup="listbox" aria-autocomplete="list"
      aria-controls={visible ? listId : undefined}
      aria-expanded={visible}
      aria-activedescendant={visible && results.length
        ? listId + "-option-" + Math.min(active, results.length - 1) : undefined}
      placeholder="Nhập ít nhất 2 ký tự để tìm nhiệm vụ"
      value={text}
      onFocus={() => { if (!value) setOpen(true); }}
      onChange={event => {
        setText(event.target.value);
        if (value) onChange(null);
        setOpen(true);
        setActive(0);
      }}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (!visible || !results.length) return;
        if (event.key === "ArrowDown") {
          event.preventDefault(); setActive(index => (index + 1) % results.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault(); setActive(index => (index + results.length - 1) % results.length);
        } else if (event.key === "Enter") {
          event.preventDefault(); choose(results[Math.min(active, results.length - 1)]!);
        }
      }} />
    {visible ? <div id={listId} role="listbox" aria-label="Kết quả tìm nhiệm vụ"
      className={styles.results}>
      {results.length ? results.map((mission, index) =>
        <button key={mission.id} id={listId + "-option-" + index}
          role="option" aria-selected={index === active}
          type="button" className={index === active ? styles.active : styles.option}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(mission)}>
          <span className={styles.code}>{mission.code}</span>
          <span className={styles.name}>{mission.name}</span>
        </button>,
      ) : <p role="status" className={styles.empty}>Không tìm thấy nhiệm vụ phù hợp.</p>}
    </div> : null}
  </div>;
}
