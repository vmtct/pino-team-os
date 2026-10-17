import { createElement } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faCircleCheck, faClock, faWallet } from "@fortawesome/free-solid-svg-icons";
import type { TosFooterItem } from "./TosShell";

// Team Surface Doctrine v1: Home is the app launcher. Contextual app footers
// replace Home navigation and never spend a slot on the Home escape hatch.
export const TOS_HOME_FOOTER: TosFooterItem[] = [
  { id: "home", label: "Home", href: "/", icon: "⌂" },
  { id: "shift", label: "Ca làm", href: "/dashboard", icon: "◷" },
  { id: "classroom", label: "Lớp học", href: "/classroom", icon: "▤" },
  { id: "tasks", label: "Việc", href: "/tasks", icon: "◌" },
  { id: "pinoria", label: "Pinoria", href: "/pinoria", icon: "◈" },
];

const shiftIcon = (icon: typeof faCircleCheck) => createElement(FontAwesomeIcon, { icon });

// Approved PAP-699 Ca Làm navigation: exactly four tabs.
export const TOS_SHIFT_FOOTER: TosFooterItem[] = [
  { id: "today", label: "Hôm nay", href: "/dashboard", icon: shiftIcon(faCircleCheck) },
  { id: "schedule", label: "Lịch ca", href: "/schedule", icon: shiftIcon(faCalendarDays) },
  { id: "history", label: "Giờ công", href: "/timesheet", icon: shiftIcon(faClock) },
  { id: "income", label: "Thu nhập", href: "/earnings", icon: shiftIcon(faWallet) },
];

// Only expose implemented Classroom sub-navigation. Future F phases may append
// approved pedagogy tabs up to the five-item doctrine limit.
export const TOS_CLASSROOM_FOOTER: TosFooterItem[] = [
  { id: "today", label: "Lớp hôm nay", href: "/classroom", icon: "▤" },
];

// The Tasks app family is canonical even before an attention projection exists.
// Its current shell is intentionally empty-state only; no local task truth is invented.
export const TOS_TASKS_FOOTER: TosFooterItem[] = [
  { id: "all", label: "Tất cả", href: "/tasks", icon: "◌" },
];

export const TOS_PINORIA_FOOTER: TosFooterItem[] = [
  { id: "presence", label: "Hiện diện", href: "/pinoria", icon: "◉" },
  { id: "onboarding", label: "Onboard", href: "/pinoria/onboarding", icon: "✦" },
  { id: "attendance", label: "Điểm danh", href: "/pinoria/attendance", icon: "✓" },
];

// Open Studio is currently app_family:NONE. Keep its operational desk bounded
// instead of leaking global app navigation into the contextual footer.
export const TOS_OPEN_STUDIO_FOOTER: TosFooterItem[] = [
  { id: "desk", label: "Open Studio", href: "/open-studio", icon: "▣" },
];

export const TOS_TV_FOOTER: TosFooterItem[] = [{ id: "tv", label: "TV", href: "/tv", icon: "▣" }];
