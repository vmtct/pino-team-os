/** PAP-1495 / SPEC-UNLOCK. Pure HO Mission relation selector; never persists links. */
export interface SpecialtyMissionOption {
  id: string;
  code: string;
  name: string;
  pathProgramId: string | null;
  status: "ACTIVE" | "INACTIVE";
  reconciliation: "READY" | "PENDING";
}

/** NFD strips Vietnamese accents; đ needs independent transliteration. */
export function normalizeSpecialtyMissionSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d").toLocaleLowerCase("vi").trim();
}

/**
 * The query threshold is two normalized characters. Only authoritative
 * ACTIVE+READY Mission references with exactly the selected Path can appear.
 * The parent still has to validate authorization and the resulting link on Core.
 */
export function searchLinkableSpecialtyMissions(
  missions: readonly SpecialtyMissionOption[],
  pathProgramId: string,
  alreadyLinked: ReadonlySet<string>,
  query: string,
): SpecialtyMissionOption[] {
  const text = normalizeSpecialtyMissionSearch(query);
  if (text.length < 2 || !pathProgramId) return [];
  return missions.filter(mission =>
    mission.status === "ACTIVE" && mission.reconciliation === "READY" &&
    mission.pathProgramId === pathProgramId && !alreadyLinked.has(mission.id) &&
    (normalizeSpecialtyMissionSearch(mission.code).includes(text) ||
     normalizeSpecialtyMissionSearch(mission.name).includes(text)),
  ).sort((a, b) => a.code.localeCompare(b.code, "vi") || a.id.localeCompare(b.id));
}
