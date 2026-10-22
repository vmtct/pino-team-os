/** PAP-882 — pure BO sidebar search/collapse behavior; permissions are filtered upstream. */
export type BoSidebarGroup = { label: string; items: readonly { label: string; href: string }[] };
export type BoSidebarState = { collapsed: readonly string[]; query: string };
export function normalizeSidebarSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi").trim();
}
export function visibleBoSidebarGroups(groups: readonly BoSidebarGroup[], state: BoSidebarState) {
  const needle = normalizeSidebarSearch(state.query);
  const collapsed = new Set(state.collapsed);
  return groups.map(group => {
    const matches = needle ? group.items.filter(item => normalizeSidebarSearch(item.label).includes(needle)) : group.items;
    const groupMatches = needle && normalizeSidebarSearch(group.label).includes(needle);
    const items = groupMatches ? group.items : matches;
    return { ...group, items: needle ? items : collapsed.has(group.label) ? [] : items,
      expanded: needle ? Boolean(items.length) : !collapsed.has(group.label) };
  }).filter(group => !needle || group.items.length > 0);
}
export function toggleBoSidebarGroup(collapsed: readonly string[], label: string): string[] {
  const current = new Set(collapsed);
  if (current.has(label)) current.delete(label); else current.add(label);
  return [...current];
}
export function collapseAllBoSidebarGroups(groups: readonly BoSidebarGroup[]): string[] {
  return groups.map(group => group.label);
}
