export type OwnerKind = "STUDENT" | "STAFF";
export type VisualKind = "PNG" | "WEBM";
export type RequirementKind = "FRUIT" | "GLOBAL_ITEM";

export type LevelRequirement = {
  kind: RequirementKind;
  quantity: number;
  globalItemId?: string;
};

export type CompanionLevel = {
  level: number;
  label: string;
  visualKind: VisualKind;
  visualAssetKey: string;
  metadata: string;
  requirementToNext: LevelRequirement | null;
};

export type CompanionSpecies = {
  id: string;
  key: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  metadata: string;
  levels: CompanionLevel[];
};

export type OwnedCompanion = {
  id: string;
  speciesId: string;
  currentLevel: number;
  progressByLevel: Record<number, number>;
  bringAlong: boolean;
};

export type CompanionOwner = {
  id: string;
  kind: OwnerKind;
  name: string;
  subtitle: string;
  companions: OwnedCompanion[];
};

export function normalizeLevels(levels: CompanionLevel[]): CompanionLevel[] {
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  return sorted.map((entry, index) => ({
    ...entry,
    level: index + 1,
    requirementToNext: index === sorted.length - 1 ? null : entry.requirementToNext ?? { kind: "FRUIT", quantity: 1 },
  }));
}

export function setBringAlong(companions: OwnedCompanion[], companionId: string | null): OwnedCompanion[] {
  return companions.map((entry) => ({ ...entry, bringAlong: companionId !== null && entry.id === companionId }));
}

export function setManualLevel(companion: OwnedCompanion, requestedLevel: number, species: CompanionSpecies): OwnedCompanion {
  const valid = species.levels.some((entry) => entry.level === requestedLevel);
  if (!valid) return companion;
  return { ...companion, currentLevel: requestedLevel };
}

export function setManualProgress(companion: OwnedCompanion, level: number, value: number): OwnedCompanion {
  return {
    ...companion,
    progressByLevel: { ...companion.progressByLevel, [level]: Math.max(0, Number.isFinite(value) ? value : 0) },
  };
}

export function currentRequirement(companion: OwnedCompanion, species: CompanionSpecies): LevelRequirement | null {
  return species.levels.find((entry) => entry.level === companion.currentLevel)?.requirementToNext ?? null;
}
