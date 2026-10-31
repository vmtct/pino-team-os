/** Presentation-only ShiftPlan label; underlying Core week identity is unchanged. */
export function workforceWeekDisplayLabel(raw: string): string {
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})\s*→\s*(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  const code = raw.match(/\bW\d+\b/i)?.[0];
  const range = match[3] + "/" + match[2] + "–" + match[6] + "/" + match[5] + "/" + match[4];
  return (code ? code.toUpperCase() + " · " : "") + range;
}
