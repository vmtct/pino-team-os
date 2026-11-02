import type { BoAccessAuditPage } from "./bo-api";

export type BoAccessAuditBrowseState = {
  page: number;
  pageSize: number;
  search: string;
  outcome: string;
};

export async function loadBoAccessAuditPageForState(
  state: BoAccessAuditBrowseState,
  fetchPage: (input: { limit: number; offset: number; query?: string; outcome?: string }) => Promise<BoAccessAuditPage>,
): Promise<{ kind: "ready"; data: BoAccessAuditPage } | { kind: "reconcile-page"; page: number }> {
  const data = await fetchPage({
    limit: state.pageSize,
    offset: (state.page - 1) * state.pageSize,
    ...(state.search ? { query: state.search } : {}),
    ...(state.outcome ? { outcome: state.outcome } : {}),
  });
  const lastValidPage = Math.max(1, data.page.pageCount);
  return state.page > lastValidPage
    ? { kind: "reconcile-page", page: lastValidPage }
    : { kind: "ready", data };
}
