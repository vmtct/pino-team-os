import type { TrainingAssignmentBrowsePage, TrainingAssignmentBrowseSort } from "./training-model";

export const BO_TRAINING_ASSIGNMENTS_MAX_OFFSET = 1_000_000;

export type BoTrainingAssignmentBrowseState = {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sort: TrainingAssignmentBrowseSort;
  direction: "asc" | "desc";
};

export async function loadBoTrainingAssignmentPageForState(
  state: BoTrainingAssignmentBrowseState,
  fetchPage: (input: { limit: number; offset: number; query?: string; status?: string; sort?: TrainingAssignmentBrowseSort; direction?: "asc" | "desc" }) => Promise<TrainingAssignmentBrowsePage>,
): Promise<{ kind: "ready"; data: TrainingAssignmentBrowsePage } | { kind: "reconcile-page"; page: number }> {
  const maxRequestPage = Math.floor(BO_TRAINING_ASSIGNMENTS_MAX_OFFSET / state.pageSize) + 1;
  if (state.page > maxRequestPage) return { kind: "reconcile-page", page: maxRequestPage };
  const data = await fetchPage({
    limit: state.pageSize,
    offset: (state.page - 1) * state.pageSize,
    ...(state.search ? { query: state.search } : {}),
    ...(state.status ? { status: state.status } : {}),
    sort: state.sort,
    direction: state.direction,
  });
  const lastValidPage = Math.max(1, data.page.pageCount);
  return state.page > lastValidPage ? { kind: "reconcile-page", page: lastValidPage } : { kind: "ready", data };
}
