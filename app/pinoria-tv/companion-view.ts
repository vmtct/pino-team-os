import type { CompanionProjectionSnapshot } from "./shop-types";

export type CompanionViewSource = {
  companion?: string;
  companionState?: CompanionProjectionSnapshot;
};

export type CompanionView = {
  active: boolean;
  displayName: string;
  species: string;
  level: number | null;
  formLabel: string;
  fullLabel: string;
  visualId: string | null;
};

function emptyCompanion(): CompanionView {
  return {
    active: false,
    displayName: "Hộ Linh",
    species: "",
    level: null,
    formLabel: "",
    fullLabel: "Chưa có Hộ Linh",
    visualId: null,
  };
}
function viewFromProjection(projection: CompanionProjectionSnapshot): CompanionView {
  const active = projection.active;
  if (!active) return emptyCompanion();
  return {
    active: true,
    displayName: active.displayName,
    species: active.species,
    level: active.level,
    formLabel: active.formLabel,
    fullLabel: [active.displayName, active.species, `Cấp ${active.level}`].filter(Boolean).join(" · "),
    visualId: active.visualId,
  };
}

function viewFromLegacy(value?: string): CompanionView {
  const legacy = value?.trim();
  if (!legacy || legacy.toLocaleLowerCase("vi-VN").startsWith("chưa có")) return emptyCompanion();
  const parts = legacy.split("·").map((part) => part.trim()).filter(Boolean);
  const levelMatch = legacy.match(/Cấp\s*(\d+)/i);
  const level = levelMatch ? Number(levelMatch[1]) : null;
  return {
    active: true,
    displayName: parts[0] || "Hộ Linh",
    species: parts[1] || "",
    level,
    formLabel: level ? `Cấp ${level}` : "",
    fullLabel: legacy,
    visualId: null,
  };
}

export function companionView(source: CompanionViewSource): CompanionView {
  if (source.companionState) return viewFromProjection(source.companionState);
  return viewFromLegacy(source.companion);
}
