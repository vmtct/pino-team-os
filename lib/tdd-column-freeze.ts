/** Pure geometry policy; the caller supplies measured DOM widths. */
export type FrozenColumn = { readonly key: string; readonly left: number };
export function normalizeFreezeBoundary(boundary: string | null | undefined, order: readonly string[], visible: readonly string[]): string | null {
  if (!boundary || boundary === order[0] || !order.includes(boundary) || !visible.includes(boundary)) return null;
  return boundary;
}
export function frozenPrefix(
  visibleOrder: readonly string[], boundary: string | null | undefined,
  widths: Readonly<Record<string, number>>, openerWidth: number, viewportWidth: number, minScrollable = 112,
): readonly FrozenColumn[] {
  if (!visibleOrder.length || !Number.isFinite(viewportWidth) || viewportWidth <= 0 ||
      !Number.isFinite(openerWidth) || openerWidth < 0 || !Number.isFinite(minScrollable) || minScrollable <= 0) return [];
  const prefix: FrozenColumn[] = []; let left = Math.max(0, openerWidth);
  const target = visibleOrder.indexOf(boundary ?? "");
  for (let index = 0; index < visibleOrder.length; index++) {
    const key = visibleOrder[index];
    if (index > 0 && (target < index || target < 0)) break;
    const width = widths[key];
    if (!Number.isFinite(width) || width <= 0) break;
    if (index > 0 && left + width > viewportWidth - minScrollable) break;
    prefix.push({ key, left }); left += width;
  }
  return prefix;
}
