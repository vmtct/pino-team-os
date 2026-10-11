export const BO_TIMEKEEPING_MAX_OFFSET = 1_000_000;

type TimekeepingQuery = {
  centerId: string;
  workDate?: string;
  startDate?: string;
  endDate?: string;
  staffMemberId?: string;
  status?: "OPEN" | "CLOSED";
};

type TimekeepingPageLike = { summary: { totalSessions: number } };

type LoadArgs<T extends TimekeepingPageLike> = {
  page: number;
  pageSize: number;
  query: TimekeepingQuery;
  load: (params: TimekeepingQuery & { limit: number; offset: number }) => Promise<T>;
};

export async function loadBoTimekeepingPageForState<T extends TimekeepingPageLike>({ page, pageSize, query, load }: LoadArgs<T>) {
  const maxRequestPage = Math.floor(BO_TIMEKEEPING_MAX_OFFSET / pageSize) + 1;
  if (page > maxRequestPage) return { kind: "reconcile-page" as const, page: maxRequestPage };

  const data = await load({ ...query, limit: pageSize, offset: (page - 1) * pageSize });
  const pageCount = data.summary.totalSessions ? Math.ceil(data.summary.totalSessions / pageSize) : 0;
  const canonicalPage = pageCount ? Math.min(page, pageCount) : 1;
  if (canonicalPage !== page) return { kind: "reconcile-page" as const, page: canonicalPage };
  return { kind: "ready" as const, data };
}
