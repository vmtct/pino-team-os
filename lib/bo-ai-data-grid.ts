export type AiDataStatus = "PENDING_APPROVAL" | "APPLYING" | "APPLIED" | "REJECTED" | "OUTCOME_UNKNOWN";
export type AiDataInboxFilter = "" | "PENDING_APPROVAL" | "NEEDS_RECONCILE" | "APPLIED" | "REJECTED";
export type AiDataInboxSort = "purpose" | "status" | "operations" | "submittedAt" | "updatedAt";

export type AiDataPreview = {
  operationCount: number;
  destructiveOperationCount: number;
  destinationTables: Array<{ table: string; creates: number }>;
};

export type AiDataChangeSetSummary = {
  id: string;
  status: AiDataStatus;
  source: "GPT";
  purpose: string;
  schemaVersion: "v1";
  planHash: string;
  preview: AiDataPreview;
  submittedAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  appliedAt: string | null;
  version: number;
};

export function projectAiDataGrid(
  items: readonly AiDataChangeSetSummary[],
  state: { page: number; pageSize: number; search: string; status: AiDataInboxFilter; sort: AiDataInboxSort; direction: "asc" | "desc" },
) {
  const query = state.search.trim().toLocaleLowerCase("en-US");
  const filtered = items.filter((item) => {
    if (state.status === "NEEDS_RECONCILE" && item.status !== "APPLYING" && item.status !== "OUTCOME_UNKNOWN") return false;
    if (state.status && state.status !== "NEEDS_RECONCILE" && item.status !== state.status) return false;
    if (!query) return true;
    const haystack = [
      item.id,
      item.purpose,
      item.planHash,
      item.status,
      ...item.preview.destinationTables.map((target) => target.table),
    ].join(" ").toLocaleLowerCase("en-US");
    return haystack.includes(query);
  });

  const factor = state.direction === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((left, right) => {
    const primary = compare(left, right, state.sort) * factor;
    return primary || left.id.localeCompare(right.id) * factor;
  });
  const total = sorted.length;
  const pageCount = total ? Math.ceil(total / state.pageSize) : 0;
  const page = Math.min(Math.max(1, state.page), Math.max(1, pageCount));
  const offset = (page - 1) * state.pageSize;
  return {
    items: sorted.slice(offset, offset + state.pageSize),
    total,
    page,
    pageCount,
    reconcilePage: page !== state.page ? page : null,
  };
}

function compare(left: AiDataChangeSetSummary, right: AiDataChangeSetSummary, sort: AiDataInboxSort) {
  if (sort === "purpose") return left.purpose.localeCompare(right.purpose);
  if (sort === "status") return left.status.localeCompare(right.status);
  if (sort === "operations") return left.preview.operationCount - right.preview.operationCount;
  if (sort === "submittedAt") return left.submittedAt.localeCompare(right.submittedAt);
  return left.updatedAt.localeCompare(right.updatedAt);
}
