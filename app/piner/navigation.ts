// PAP-1749 · PNR-APP-HUB · independent tab data, single shared UI renderer.
import type { PinerAppKey } from "./catalog";
export type NavIcon = "home" | "spark" | "art" | "music" | "book" | "star" | "calendar" | "ticket" | "piano" | "palette";
export type NavItem = { id: string; label: string; icon: NavIcon };
export const APP_NAV: Record<PinerAppKey, readonly NavItem[]> = {
  "little-art": [
    { id: "home", label: "Trang chủ", icon: "home" },
    { id: "colors", label: "Sắc màu", icon: "palette" },
    { id: "works", label: "Tác phẩm", icon: "art" },
    { id: "journey", label: "Hành trình", icon: "star" }
  ],
  "little-piano": [
    { id: "home", label: "Trang chủ", icon: "home" },
    { id: "sounds", label: "Âm thanh", icon: "music" },
    { id: "songs", label: "Bài hát", icon: "book" },
    { id: "journey", label: "Hành trình", icon: "star" }
  ],
  piano: [
    { id: "home", label: "Trang chủ", icon: "home" },
    { id: "practice", label: "Luyện đàn", icon: "piano" },
    { id: "songs", label: "Bài đàn", icon: "music" },
    { id: "progress", label: "Tiến bộ", icon: "star" }
  ],
  artchitect: [
    { id: "home", label: "Trang chủ", icon: "home" },
    { id: "projects", label: "Dự án", icon: "spark" },
    { id: "gallery", label: "Phòng tranh", icon: "art" },
    { id: "journey", label: "Hành trình", icon: "star" }
  ],
  mytime: [
    { id: "home", label: "Trang chủ", icon: "home" },
    { id: "workshop", label: "Workshop", icon: "palette" },
    { id: "piano", label: "Piano", icon: "music" },
    { id: "tickets", label: "Vé của tôi", icon: "ticket" }
  ]
};
export const getTabHref = (app: PinerAppKey, tab: string) =>
  tab === "home" ? `/piner/${app}` : `/piner/${app}/${tab}`;
