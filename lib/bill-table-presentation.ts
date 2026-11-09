// PAP-1526 / PAP-1422 · PAP-1362 (PLT-BILL-HO). No identity enrichment.
export const maskedBillIdentity = "Đã ẩn";
export const unavailableBillCode = "Chưa có mã";

/** Read the existing authorized ledger only; refunds and voids are not collections. */
export function latestBillPayment(transactions: readonly {
  transactionKind: string; status: string; occurredAt: string;
}[]): string | null {
  let latest: string | null = null;
  for (const t of transactions) {
    if (t.transactionKind !== "PAYMENT" || t.status !== "CONFIRMED") continue;
    if (!Number.isFinite(Date.parse(t.occurredAt))) throw Error("Ngày thanh toán không hợp lệ.");
    const at = new Date(t.occurredAt).toISOString();
    if (latest === null || at > latest) latest = at;
  }
  return latest;
}
