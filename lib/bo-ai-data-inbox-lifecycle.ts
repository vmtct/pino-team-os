export type RequestTicket = { generation: number; key: string };

export function createLatestRequestGuard() {
  let generation = 0;
  return {
    begin(key: string): RequestTicket { return { generation: ++generation, key }; },
    invalidate() { generation += 1; },
    isCurrent(ticket: RequestTicket, key: string) { return ticket.generation === generation && ticket.key === key; },
  };
}

export function canRenderAiDataActions(input: { selectedId: string; detailId: string | null; detailLoading: boolean }) {
  return Boolean(input.selectedId && input.detailId === input.selectedId && !input.detailLoading);
}

export function reconciledAiDataPage(input: { listReady: boolean; loading: boolean; reconcilePage: number | null }) {
  if (!input.listReady || input.loading) return null;
  return input.reconcilePage;
}
