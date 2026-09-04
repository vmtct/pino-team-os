export type RequestTicket = { sequence: number; target: string };
export class LatestRequestFence {
  private sequence = 0;
  begin(target: string): RequestTicket { return { sequence: ++this.sequence, target }; }
  invalidate() { this.sequence += 1; }
  isCurrent(ticket: RequestTicket, currentTarget: string | null) {
    return ticket.sequence === this.sequence && ticket.target === currentTarget;
  }
}

export async function collectPagedDirectory<T extends { id: string }>(
  fetchPage: (beforeStudentId: string | undefined, limit: number) => Promise<T[]>,
  pageSize = 200,
  maxPages = 100,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let beforeStudentId: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchPage(beforeStudentId, pageSize);
    if (batch.length > pageSize) throw new Error("Learner directory page exceeded its requested bound.");
    for (const row of batch) {
      if (seen.has(row.id)) throw new Error("Learner directory pagination did not advance.");
      seen.add(row.id); rows.push(row);
    }
    if (batch.length < pageSize) return rows;
    const next = batch.at(-1)?.id;
    if (!next || next === beforeStudentId) throw new Error("Learner directory pagination did not advance.");
    beforeStudentId = next;
  }
  throw new Error("Learner directory exceeded the supported pagination safety bound.");
}
