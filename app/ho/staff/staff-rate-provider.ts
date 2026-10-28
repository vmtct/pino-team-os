import type { BusinessFormData, BusinessFormProvider, BusinessFormRequest, BusinessFormSubmitResult, BusinessFormValue } from "@/app/components/workspace-renderer/Slots";

type Rate = { id: string; staffMemberId: string; effectiveFrom: string; periodUntilExclusive: string | null; amountMinor: number; currency: "VND"; note: string | null };
const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = /^\d{4}-\d{2}-\d{2}$/;
const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const day = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
const dayBefore = (value: string) => new Date(Date.parse(value + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
const fields = [
  { key: "amount", label: "Mức lương (₫/giờ)", type: "number", required: true },
  { key: "effectiveDate", label: "Hiệu lực từ", type: "date", required: true },
  { key: "reason", label: "Lý do", type: "textarea", required: true },
] as const;
function urlFor(request: BusinessFormRequest): string {
  if (request.surface !== "HO" || request.moduleKey !== "staffs" || request.slotId !== "staff-rate" ||
      request.sourceAdapter !== "salary.staff-rate" || !id.test(request.recordId) ||
      request.subject.id !== request.recordId || request.subject.type !== "staffs" || !request.principalId) {
    throw Error("Invalid HO Staff Rate binding");
  }
  return "/api/ho/staff/" + encodeURIComponent(request.recordId) + "/compensation";
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && iso.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}
/** Domain-only adapter. BFF/Core enforces the actual Founder permission and tenant boundary. */
export const staffRateProvider: BusinessFormProvider = {
  surface: "HO", moduleKey: "staffs", slotId: "staff-rate", sourceAdapter: "salary.staff-rate",
  async load(request, signal): Promise<BusinessFormData> {
    const response = await fetch(urlFor(request), { method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error", signal });
    signal.throwIfAborted();
    if ([401, 403, 404].includes(response.status)) return { status: "denied" };
    if (!response.ok) throw Error("Rate history unavailable");
    const payload: unknown = await response.json();
    signal.throwIfAborted();
    if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) throw Error("Invalid private rate response");
    const rates = payload.data as Rate[];
    if (rates.some(rate => !rate || !id.test(rate.id) || rate.staffMemberId !== request.recordId ||
      !validDate(rate.effectiveFrom) || (rate.periodUntilExclusive !== null && !validDate(rate.periodUntilExclusive)) ||
      !Number.isSafeInteger(rate.amountMinor) || rate.amountMinor < 1 || rate.currency !== "VND" ||
      (rate.note !== null && typeof rate.note !== "string"))) throw Error("Invalid rate ledger");
    const sorted = [...rates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    // Core returns one immutable rate per effective day. Reject contradictory private
    // ledgers rather than presenting a misleading amount/date interval as authoritative.
    if (new Set(sorted.map(rate => rate.id)).size !== sorted.length ||
        sorted.some((rate, index) =>
          index === 0
            ? rate.periodUntilExclusive !== null
            : rate.effectiveFrom >= sorted[index - 1]!.effectiveFrom ||
              rate.periodUntilExclusive !== sorted[index - 1]!.effectiveFrom)) {
      throw Error("Invalid rate ledger chronology");
    }
    const rows = sorted.map(rate => ({
      id: rate.id,
      values: {
        effectiveFrom: day(rate.effectiveFrom),
        effectiveUntil: rate.periodUntilExclusive ? day(dayBefore(rate.periodUntilExclusive)) : "—",
        amount: money.format(rate.amountMinor) + " ₫/giờ",
        reason: rate.note ?? "—",
      },
    }));
    return {
      status: "authorized", fields,
      values: { amount: null, effectiveDate: null, reason: "" },
      records: { label: "Lịch sử Rate", columns: [
        { key: "effectiveFrom", label: "Ngày hiệu lực", type: "text" },
        { key: "effectiveUntil", label: "Ngày kết thúc", type: "text" },
        { key: "amount", label: "Mức lương", type: "text" },
        { key: "reason", label: "Lý do", type: "text" },
      ], rows },
    };
  },
  async submit(request, values: Readonly<Record<string, BusinessFormValue>>, signal): Promise<BusinessFormSubmitResult> {
    const url = urlFor(request);
    if (Object.keys(values).some(key => !["amount", "effectiveDate", "reason"].includes(key))) return { status: "invalid", fields: ["amount", "effectiveDate", "reason"] };
    const amount = values.amount, effectiveDate = values.effectiveDate, reason = values.reason;
    const invalid: string[] = [];
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000_000) invalid.push("amount");
    if (!validDate(effectiveDate)) invalid.push("effectiveDate");
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 500) invalid.push("reason");
    if (invalid.length) return { status: "invalid", fields: invalid };
    const response = await fetch(url, {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ amountMinor: amount, effectiveFrom: effectiveDate, note: reason.trim() }),
    });
    signal.throwIfAborted();
    if ([401, 403, 404].includes(response.status)) return { status: "denied" };
    if ([400, 409, 422].includes(response.status)) return { status: "invalid", fields: response.status === 409 ? ["effectiveDate"] : ["amount", "effectiveDate", "reason"] };
    if (response.status !== 201 && response.status !== 200) throw Error("Rate save unavailable");
    return { status: "saved", message: "Đã lưu mức lương." };
  },
};
