"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowUpRightFromSquare,
  faBell,
  faCalendarDays,
  faCat,
  faChevronRight,
  faClock,
  faDesktop,
  faGear,
  faLocationDot,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./page.module.css";
import ShiftPrototype from "./ShiftPrototype";

const R2_BASE =
  process.env.NEXT_PUBLIC_TOS_ASSET_BASE ??
  "https://pub-892fa79b018d4d2f9b0808189dd2ce46.r2.dev";

type AppItem = {
  id: string;
  title: string;
  asset: string;
  fallback: IconDefinition;
  requiredRoles?: string[];
  desktopOnly?: boolean;
  reason?: string;
  tone: string;
};

const SHIFT_ROLES = ["FRONT_DESK", "SHIFT_LEAD"];

const APPS: AppItem[] = [
  { id: "shift", title: "Ca làm", asset: "shift.png", fallback: faCalendarDays, tone: "blue" },
  { id: "reception", title: "Tiếp tân", asset: "frontdesk.png", fallback: faLocationDot, requiredRoles: ["FRONT_DESK"], reason: "Bạn chưa được phân công Tiếp tân trong ca này.", tone: "blue" },
  { id: "station", title: "Trạm TOS", asset: "tosStation.png", fallback: faDesktop, desktopOnly: true, reason: "Trạm TOS chỉ dùng trên máy tính.", tone: "violet" },
  { id: "shift-lead", title: "Trưởng ca", asset: "shiftlead.png", fallback: faClock, requiredRoles: ["SHIFT_LEAD"], reason: "Bạn chưa được phân công quyền Trưởng ca.", tone: "coral" },
  { id: "classroom", title: "Lớp học", asset: "class.png", fallback: faCalendarDays, requiredRoles: ["TA", "TE"], reason: "Lớp học chưa thuộc vai trò của bạn trong ca này.", tone: "green" },
];

function resolveAppAccess(app: AppItem, desktop: boolean) {
  if (app.id === "shift") return { enabled: true, reason: "" };
  if (app.desktopOnly) return desktop ? { enabled: true, reason: "" } : { enabled: false, reason: app.reason ?? "Chỉ dùng trên máy tính." };
  if (app.requiredRoles?.some((role) => SHIFT_ROLES.includes(role))) return { enabled: true, reason: "" };
  return { enabled: false, reason: app.reason ?? "Ứng dụng chưa khả dụng trong ca này." };
}

function AppTile({ app, desktop, onOpen }: { app: AppItem; desktop: boolean; onOpen: (app: AppItem, enabled: boolean, reason: string) => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const access = resolveAppAccess(app, desktop);

  return (
    <button
      type="button"
      className={`${styles.appTile} ${styles[app.tone]} ${!access.enabled ? styles.disabled : ""}`}
      aria-disabled={!access.enabled}
      aria-label={access.enabled ? `Mở ${app.title}` : `${app.title}. ${access.reason}`}
      onClick={() => onOpen(app, access.enabled, access.reason)}
    >
      <span className={styles.iconFrame}>
        {!imageFailed ? <img className={styles.appImage} src={`${R2_BASE}/AppIcon/${app.asset}`} alt="" onError={() => setImageFailed(true)} /> : <span className={styles.iconFallback}><FontAwesomeIcon icon={app.fallback} /></span>}
        {!access.enabled ? <span className={styles.lockBadge} aria-hidden="true"><FontAwesomeIcon icon={faLock} /></span> : null}
      </span>
      <span className={styles.appLabel}>{app.title}</span>
    </button>
  );
}

export default function TosHomeV2Prototype() {
  const [desktop, setDesktop] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeApp, setActiveApp] = useState<"home" | "shift">("home");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 760px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);

    const background = new Image();
    background.onload = () => setBackgroundReady(true);
    background.onerror = () => setBackgroundReady(false);
    background.src = `${R2_BASE}/Background.jpg`;

    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (activeApp === "shift") return <ShiftPrototype onHome={() => setActiveApp("home")} />;

  return (
    <main className={styles.screen}>
      <div className={`${styles.background} ${backgroundReady ? styles.backgroundLoaded : ""}`} style={backgroundReady ? { backgroundImage: `url("${R2_BASE}/Background.jpg")` } : undefined} aria-hidden="true" />
      {!backgroundReady ? <FontAwesomeIcon className={styles.fallbackCat} icon={faCat} aria-hidden="true" /> : null}

      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.greeting}>
            <div className={styles.avatar}>L</div>
            <div><span className={styles.kicker}>PINO · TEAM OPS</span><h1>Xin chào, Linh</h1></div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.headerButton} aria-label="Thông báo" onClick={() => setNotice("Chưa có thông báo mới.")}><FontAwesomeIcon icon={faBell} /></button>
            <button type="button" className={styles.headerButton} aria-label="Cài đặt" onClick={() => setNotice("Cài đặt tài khoản sẽ được bổ sung sau.")}><FontAwesomeIcon icon={faGear} /></button>
          </div>
        </header>

        <button type="button" className={styles.shiftCard} onClick={() => setNotice("Ca làm · Mở lịch và chấm công trong app Ca làm.")}>
          <div className={styles.shiftTopline}>
            <span className={styles.statusDot} /><strong>Sắp đến ca</strong><span className={styles.shiftTime}>18:00–21:00</span><FontAwesomeIcon className={styles.shiftChevron} icon={faChevronRight} />
          </div>
          <div className={styles.shiftPlace}>
            <FontAwesomeIcon icon={faLocationDot} /><span>Station Ninh Kiều</span><span className={styles.separator}>·</span><span>Tiếp tân</span><span className={styles.rolePlus}>+</span><span>Trưởng ca</span>
          </div>
        </button>

        <section className={styles.appsSection} aria-label="Ứng dụng PINO">
          <div className={styles.sectionHeading}><h2>Ứng dụng</h2><span>5 apps</span></div>
          <div className={styles.appGrid}>{APPS.map((app) => <AppTile key={app.id} app={app} desktop={desktop} onOpen={(selected, enabled, reason) => { if (!enabled) setNotice("Ca này bạn chưa có quyền"); else if (selected.id === "shift") setActiveApp("shift"); else setNotice(`${selected.title} · App này sẽ được bổ sung trong prototype tiếp theo.`); }} />)}</div>
        </section>

        <footer className={styles.footer}>
          <span className={styles.footerPill}>TOS HOME V2 · PROTOTYPE</span>
          <span>{desktop ? "Desktop preview" : "Mobile-first"}</span>
        </footer>
      </div>

      {notice ? <div className={styles.toast} role="status"><FontAwesomeIcon icon={notice.includes("chưa") || notice.includes("chỉ dùng") ? faLock : faArrowUpRightFromSquare} /><span>{notice}</span></div> : null}
    </main>
  );
}
