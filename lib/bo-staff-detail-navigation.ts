/** PAP-781 Staff detail routing: only canonical grid browse state survives a detail link. */
const GRID_KEYS = new Set(["q", "sort", "dir", "page", "size"]);
const GRID_FILTER = /^f_[a-zA-Z0-9_]+$/;

export function staffDirectoryReturnQuery(input: URLSearchParams | string, fromDetail: boolean): URLSearchParams {
  const outer = typeof input === "string" ? new URLSearchParams(input) : input;
  const original = fromDetail ? new URLSearchParams(outer.get("from") ?? "") : outer;
  const result = new URLSearchParams();
  for (const [key, value] of original) {
    if ((GRID_KEYS.has(key) || GRID_FILTER.test(key)) && value.trim()) result.append(key, value);
  }
  return result;
}

export function staffDirectoryHref(input: URLSearchParams | string, fromDetail: boolean): string {
  const query = staffDirectoryReturnQuery(input, fromDetail).toString();
  return "/bo/staff" + (query ? "?" + query : "");
}

export function staffFullDetailHref(staffId: string, input: URLSearchParams | string): string {
  const query = staffDirectoryReturnQuery(input, false).toString();
  return "/bo/staff/" + encodeURIComponent(staffId) + (query ? "?from=" + encodeURIComponent(query) : "");
}
