/** PAP-2394 / HO-MISSION-CRUD — approved S0 category vocabulary. */
export const missionCategories = ["Staff Training", "PINO Afterschool", "MyTime"] as const;
export type MissionCategory = typeof missionCategories[number];
export function isMissionCategory(value: unknown): value is MissionCategory {
  return typeof value === "string" && missionCategories.some(category => category === value);
}
