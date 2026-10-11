import type { BoPancakeChannel } from "./bo-api";

export type PancakeChannelFilter = "" | "ENABLED" | "DISABLED";
export type PancakeChannelSort = "displayName" | "providerPageId" | "channel" | "status" | "discoveredBy" | "lastSeenAt" | "updatedAt";

export function projectPancakeChannels(items: readonly BoPancakeChannel[], input: { page: number; pageSize: number; search: string; status: PancakeChannelFilter; sort: PancakeChannelSort; direction: "asc" | "desc" }) {
  const query = input.search.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => {
    if (input.status === "ENABLED" && !item.enabled) return false;
    if (input.status === "DISABLED" && item.enabled) return false;
    if (!query) return true;
    return [item.providerPageId, item.displayName, item.channel, item.discoveredBy, item.id].some((value) => value.toLocaleLowerCase().includes(query));
  });
  const sorted = [...filtered].sort((left, right) => {
    const a = sortValue(left, input.sort);
    const b = sortValue(right, input.sort);
    const compared = a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
    return input.direction === "asc" ? compared : -compared;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / input.pageSize));
  const page = Math.min(Math.max(1, input.page), pageCount);
  const start = (page - 1) * input.pageSize;
  return { items: sorted.slice(start, start + input.pageSize), total: sorted.length, page, reconcilePage: page !== input.page ? page : null };
}

function sortValue(item: BoPancakeChannel, sort: PancakeChannelSort) {
  if (sort === "status") return item.enabled ? "enabled" : "disabled";
  return String(item[sort]);
}
