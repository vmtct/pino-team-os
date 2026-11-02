export type EffectCatalogDefinition = {
  key: string;
  displayName: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  implementationVersion: number;
  description: string;
  capabilities: string[];
  fullAvatarDescription: string;
  houseMiniDescription: string;
};

export type EffectCatalogGridSortKey = "effect" | "rarity" | "version" | "capabilities" | "surfaces";

export type EffectCatalogGridRow = {
  item: EffectCatalogDefinition;
  surfaceLabel: string;
  capabilityLabel: string;
};

export type EffectCatalogGridOptions = {
  search?: string;
  rarity?: string;
  sortKey?: EffectCatalogGridSortKey;
  sortDirection?: "asc" | "desc";
};

const rarityOrder: Record<EffectCatalogDefinition["rarity"], number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
};

export function isEffectCatalogGridSortKey(value: string | null): value is EffectCatalogGridSortKey {
  return value === "effect" || value === "rarity" || value === "version" || value === "capabilities" || value === "surfaces";
}

export function buildEffectCatalogGridRows(
  catalog: readonly EffectCatalogDefinition[],
  options: EffectCatalogGridOptions = {},
): EffectCatalogGridRow[] {
  const search = options.search?.trim().toLowerCase() ?? "";
  const rarity = options.rarity?.trim().toUpperCase() ?? "";
  const sortKey = options.sortKey ?? "effect";
  const direction = options.sortDirection === "desc" ? -1 : 1;

  const rows = catalog.map((item) => {
    const surfaces = [
      item.capabilities.includes("FULL_AVATAR") ? "Full avatar" : null,
      item.capabilities.includes("HOUSE_MINI") ? "House mini" : null,
    ].filter((value): value is string => Boolean(value));
    return {
      item,
      surfaceLabel: surfaces.join(" · ") || "—",
      capabilityLabel: item.capabilities.map(prettyEffectCatalogToken).join(" · ") || "—",
    };
  }).filter((row) => {
    if (rarity && row.item.rarity !== rarity) return false;
    if (!search) return true;
    return [
      row.item.displayName,
      row.item.key,
      row.item.rarity,
      String(row.item.implementationVersion),
      row.capabilityLabel,
      row.surfaceLabel,
      row.item.description,
    ].some((value) => value.toLowerCase().includes(search));
  });

  return rows.sort((left, right) => {
    const primary = compareEffectCatalogRows(left, right, sortKey) * direction;
    return primary || left.item.key.localeCompare(right.item.key);
  });
}

export function prettyEffectCatalogToken(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compareEffectCatalogRows(left: EffectCatalogGridRow, right: EffectCatalogGridRow, sortKey: EffectCatalogGridSortKey) {
  switch (sortKey) {
    case "rarity": return rarityOrder[left.item.rarity] - rarityOrder[right.item.rarity];
    case "version": return left.item.implementationVersion - right.item.implementationVersion;
    case "capabilities": return left.capabilityLabel.localeCompare(right.capabilityLabel);
    case "surfaces": return left.surfaceLabel.localeCompare(right.surfaceLabel);
    case "effect":
    default: return left.item.displayName.localeCompare(right.item.displayName);
  }
}
