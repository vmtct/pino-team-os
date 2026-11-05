/**
 * PAP-1507 (PLT-ACCESS / PAP-1505)
 * Pure view-layer selection math. Only permission keys visible in the current
 * domain/filter participate; off-screen selections are preserved.
 */
export function groupSelectionState(selectedKeys:readonly string[],visibleKeys:readonly string[]):"none"|"mixed"|"all" {
  if(!visibleKeys.length)return "none";
  const selected=new Set(selectedKeys);
  const count=visibleKeys.filter(key=>selected.has(key)).length;
  return count===0?"none":count===visibleKeys.length?"all":"mixed";
}
export function bulkGroupPermissionKeys(selectedKeys:readonly string[],visibleKeys:readonly string[]):string[] {
  const keys=new Set(selectedKeys);
  const visible=new Set(visibleKeys);
  const all=groupSelectionState(selectedKeys,visibleKeys)==="all";
  for(const key of visible){if(all)keys.delete(key);else keys.add(key);}
  return [...keys].sort();
}
