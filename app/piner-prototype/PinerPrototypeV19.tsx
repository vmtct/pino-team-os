"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV18 from "./PinerPrototypeV18";
import { householdKeys, scenarios, type StudentScenario } from "./fixtures-v2";
import v19 from "./piner-prototype-v19.module.css";

function localizedMembership(student: StudentScenario) {
  if (student.key === "leo-attrition") return "Premium đã kết thúc";
  if (student.key === "leo-reenrolled") return "Premium đã tiếp tục";
  if (student.key === "leo-expired") return "Trải nghiệm đã kết thúc";
  if (student.mode === "FREE_EXPLORE") return "Khám Phá";
  if (student.mode === "TRIAL_PREMIUM") return "Trải nghiệm";
  if (student.mode === "EXPIRED_PREMIUM") return "Premium đã kết thúc";
  return "Premium";
}

function getScenario(key: string) {
  return scenarios.find((scenario) => scenario.key === key) ?? scenarios[0];
}

export default function PinerPrototypeV19() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scenarioKey, setScenarioKey] = useState("minh-premium");
  const [shellOpen, setShellOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const current = useMemo(() => getScenario(scenarioKey), [scenarioKey]);
  const household = useMemo(() => {
    const base = householdKeys.map(getScenario);
    return base.some((student) => student.key === current.key) ? base : [current, ...base];
  }, [current]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sync = () => {
      const select = root.querySelector<HTMLSelectElement>("#scenario");
      if (select?.value && select.value !== scenarioKey) setScenarioKey(select.value);

      const header = Array.from(root.querySelectorAll<HTMLElement>("header")).find((candidate) => candidate.textContent?.includes("PINO"));
      const device = header?.parentElement;
      if (device instanceof HTMLElement) setPortalTarget((existing) => existing === device ? existing : device);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scenarioKey]);

  function switchScenario(key: string) {
    const select = rootRef.current?.querySelector<HTMLSelectElement>("#scenario");
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(select, key);
    else select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setScenarioKey(key);
    setShellOpen(false);
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!button) return;
    const header = button.closest("header");
    if (!header || !header.textContent?.includes("PINO")) return;

    event.preventDefault();
    event.stopPropagation();
    setShellOpen(true);
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setScenarioKey(target.value);
    setShellOpen(false);
  }

  return (
    <div ref={rootRef} className={v19.root} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV18 />
      {portalTarget && shellOpen && createPortal(
        <HouseholdShell current={current} students={household} onChoose={switchScenario} onClose={() => setShellOpen(false)} />,
        portalTarget,
      )}
    </div>
  );
}

function HouseholdShell({ current, students, onChoose, onClose }: {
  current: StudentScenario;
  students: StudentScenario[];
  onChoose: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className={v19.backdrop} onMouseDown={onClose}>
      <section className={v19.sheet} onMouseDown={(event) => event.stopPropagation()}>
        <div className={v19.handle} />
        <header className={v19.sheetHeader}>
          <div>
            <span>GIA ĐÌNH</span>
            <h2>Chọn hồ sơ của con</h2>
            <p>Mỗi bé có Hành trình, Thành quả và quyền truy cập riêng.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className={v19.studentList}>
          {students.map((student) => {
            const active = student.key === current.key;
            const primaryPath = student.paths[0];
            return (
              <button key={student.key} type="button" className={active ? v19.studentActive : ""} onClick={() => onChoose(student.key)}>
                <span className={v19.avatar}>{student.avatar}</span>
                <span className={v19.studentCopy}>
                  <span className={v19.studentTopline}><strong>{student.name}</strong><em>{localizedMembership(student)}</em></span>
                  <small>{student.ageLabel}{primaryPath ? ` · ${student.paths.map((path) => path.label).join(" + ")}` : " · Chưa có chương trình Premium"}</small>
                  {primaryPath && <small>{primaryPath.summary}</small>}
                </span>
                <span className={v19.chooseMark}>{active ? "✓" : "›"}</span>
              </button>
            );
          })}
        </div>

        <section className={v19.contextCard}>
          <div className={v19.contextHead}>
            <span>HỒ SƠ ĐANG XEM</span>
            <strong>{current.shortName}</strong>
          </div>
          <div className={v19.contextGrid}>
            <div><small>Trạng thái</small><strong>{localizedMembership(current)}</strong></div>
            <div><small>Chương trình</small><strong>{current.paths.length ? current.paths.map((path) => path.label).join(" + ") : "Khám phá PINO"}</strong></div>
            <div><small>Hành trình</small><strong>{current.paths[0]?.summary ?? "Chưa bắt đầu"}</strong></div>
            <div><small>Gói hiện tại</small><strong>{current.paths[0]?.package.end ? `đến ${current.paths[0].package.end}` : "Không có gói Premium đang hoạt động"}</strong></div>
          </div>
        </section>

        <div className={v19.accountRows}>
          <button type="button"><span><strong>Tài khoản phụ huynh</strong><small>Thông tin tài khoản và liên hệ</small></span><em>›</em></button>
          <button type="button"><span><strong>Hồ sơ & bảo mật</strong><small>Thiết bị đăng nhập và bảo mật tài khoản</small></span><em>›</em></button>
          <button type="button"><span><strong>Hỗ trợ từ PINO</strong><small>Liên hệ khi cần thay đổi thông tin học viên</small></span><em>›</em></button>
        </div>

        <p className={v19.doctrine}>Mỗi bé có Hành trình, Thành quả và quyền truy cập riêng. Khi đổi hồ sơ, PINO chỉ hiển thị dữ liệu của bé đang chọn.</p>
      </section>
    </div>
  );
}