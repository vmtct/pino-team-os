/** PAP-1882 / PAP-1491 SPEC-UNLOCK — BO independent Sale admission helpers.
 * Use the already-merged PAP-1871 exact BFF route; never global Parent search.
 */
import { BoApiError } from "./bo-api-error";
import { quoteAfterDiscounts } from "./bo-subscription-create-ux";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type EligibleSalePayer = { id: string; displayName: string };
export type IndependentSaleBody = {
  centerId: string; studentProfileId: string; payerParentUserId: string;
  pathProgramId: string; productPlanId: string;
  contractualStartsOn: string; contractualEndsOn: string;
  itemDiscountMinor: number; billDiscountMinor: number;
  dueOn?: string; campaignReference?: string;
};
export function validSaleCenter(centerId: string, authorized: readonly { id: string }[]): boolean {
  return UUID.test(centerId) && authorized.some(center => center.id === centerId);
}
export async function eligibleSalePayers(
  centerId: string, studentProfileId: string, signal: AbortSignal,
  transport: typeof fetch = fetch,
): Promise<EligibleSalePayer[]> {
  if (!UUID.test(centerId) || !UUID.test(studentProfileId))
    throw new BoApiError(400, "Chọn cơ sở và học viên hợp lệ.", null);
  const url = "/api/bo/billing/sales/eligible-payers?" +
    new URLSearchParams({ centerId, studentProfileId }).toString();
  const response = await transport(url, { method:"GET", credentials:"same-origin", cache:"no-store", signal });
  if (signal.aborted) throw new Error("Cơ sở hoặc học viên đã thay đổi.");
  let payload: { data?: unknown; error?: { message?: string; requestId?: string } };
  try { payload = await response.json() as typeof payload; }
  catch { throw new BoApiError(response.status, "Không đọc được Parent đủ điều kiện.", response.headers.get("x-request-id")); }
  if (!response.ok || payload.data === undefined)
    throw new BoApiError(response.status, payload.error?.message || "Không đọc được Parent đủ điều kiện.",
      payload.error?.requestId || response.headers.get("x-request-id"));
  if (!Array.isArray(payload.data) || payload.data.length > 40 ||
      payload.data.some(p => !p || !UUID.test(p.id) || typeof p.displayName !== "string" || !p.displayName.trim()) ||
      new Set(payload.data.map(p => p.id)).size !== payload.data.length)
    throw new Error("Core trả về danh sách Parent không hợp lệ.");
  return payload.data.map(({id,displayName}:EligibleSalePayer) => ({id, displayName:displayName.trim()}));
}
function realDate(input:string):boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const date=new Date(input+"T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === input;
}
export function buildIndependentSaleBody(input: IndependentSaleBody, plan: {
  id:string; listPriceMinor:number; cadence:number; termWeeks:number; enabled:boolean;
}, eligible: readonly EligibleSalePayer[]): IndependentSaleBody {
  if (![input.centerId,input.studentProfileId,input.payerParentUserId,input.pathProgramId,input.productPlanId].every(v=>UUID.test(v)))
    throw new Error("Thông tin Sale không hợp lệ.");
  if (!plan.enabled || plan.id !== input.productPlanId || plan.termWeeks !== 12 ||
      plan.cadence < 1 || plan.cadence > 3)
    throw new Error("Product Plan không được bán trong chương trình này.");
  if (!eligible.some(p=>p.id===input.payerParentUserId))
    throw new Error("Parent không còn đủ điều kiện cho học viên tại cơ sở.");
  if (!realDate(input.contractualStartsOn) || !realDate(input.contractualEndsOn) ||
      input.contractualEndsOn < input.contractualStartsOn)
    throw new Error("Ngày hợp đồng không hợp lệ.");
  if (input.dueOn && !realDate(input.dueOn)) throw new Error("Ngày hạn thanh toán không hợp lệ.");
  if (!quoteAfterDiscounts(plan.listPriceMinor,input.itemDiscountMinor,input.billDiscountMinor).valid)
    throw new Error("Giảm giá không hợp lệ hoặc vượt giá trị gói học.");
  if (input.campaignReference && input.campaignReference.length > 200)
    throw new Error("Tham chiếu không được quá 200 ký tự.");
  return input;
}
export function assertIndependentSaleReadback(
  expected: IndependentSaleBody,
  sale: { subscriptionId:string; bill:{bill:{id:string};items:readonly {subscriptionId:string;studentProfileId:string}[]} },
  actual: { id:string; studentProfileId:string; centerId?:string; pathProgramId:string; lifecycle:string },
): void {
  if (!UUID.test(sale.subscriptionId) || !sale.bill || !sale.bill.bill ||
      !UUID.test(sale.bill.bill.id) || !Array.isArray(sale.bill.items) ||
      sale.bill.items.length !== 1 ||
      actual.id !== sale.subscriptionId || actual.studentProfileId !== expected.studentProfileId ||
      actual.centerId !== expected.centerId || actual.pathProgramId !== expected.pathProgramId ||
      actual.lifecycle !== "ACTIVE" ||
      !sale.bill.items.some(item=>item.subscriptionId===sale.subscriptionId&&item.studentProfileId===expected.studentProfileId))
    throw new Error("Core Sale chưa được xác minh đầy đủ; thử lại cùng yêu cầu.");
}