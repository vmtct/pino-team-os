import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { teamCredential, TeamAuthError } from "./team-auth";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { HO_BILLS_API, isHoBillsRequest, object, parseBillVoid, parseHoBill } from "./ho-bills-contract";
export interface HoBillsEnv extends HoEnv { PINO_CORE?: PinoCoreBinding }
const json = (body: unknown, status: number) => Response.json(body, {status, headers:{"cache-control":"no-store", "x-content-type-options":"nosniff"}});
const fail = (status: number) => json({error:{code:"HO_BILLS_UNAVAILABLE"}}, status);
export async function handleHoBills(request: Request, env: HoBillsEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" || url.protocol !== "https:" || url.hostname !== HO_STAGING_HOSTNAME || url.port ||
      normalizeHostname(request.headers.get("host") || "") !== HO_STAGING_HOSTNAME || url.search || url.hash ||
      !isHoBillsRequest(url.pathname, request.method)) return fail(404);
    const write = request.method === "POST", key = request.headers.get("idempotency-key");
    if (write && (request.headers.get("origin") !== url.origin || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")) return fail(403);
    if (write && (!key || !/^[A-Za-z0-9_-]{8,120}$/.test(key))) return fail(400);
    await authorizeHoShell(request.headers, env);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return fail(401);
    if (!env.PINO_CORE?.executeWithStaffPassword) return fail(503);
    const suffix = url.pathname.slice(HO_BILLS_API.length), id = suffix.split("/")[1];
    const core = (method: string, path: string, body?: unknown) => callFounderCoreWithStaffPassword(env.PINO_CORE!,
      {method, path:"billing/bills" + path, ...(body ? {body, idempotencyKey:key!} : {})}, credential.token);
    let command;
    if (write) {
      const raw = await request.text();
      if (raw.length > 4000) return fail(413);
      command = parseBillVoid(JSON.parse(raw));
      if (!command) return fail(400);
      const before = await core("GET", "/" + id);
      if (before.status !== 200) return fail(before.status >= 400 && before.status <= 599 ? before.status : 502);
      const bill = parseHoBill(object(before.body)?.data, true);
      if (bill.bill.id !== id || bill.bill.version !== command.expectedVersion) return fail(409);
      // Core independently rechecks actor, version and confirmed transactions atomically.
      const {canVoidBill} = await import("./ho-bills-contract");
      if (!canVoidBill(bill)) return fail(409);
    }
    const result = await core(request.method, suffix, command);
    if (result.status !== 200) return fail(result.status >= 400 && result.status <= 599 ? result.status : 502);
    try {
      const data = object(result.body)?.data;
      if (!suffix) {
        if (!Array.isArray(data) || data.length > 100) return fail(502);
        const rows = data.map(row => parseHoBill(row));
        if (new Set(rows.map(r => r.bill.id)).size !== rows.length) return fail(502);
        return json({data:rows}, 200);
      }
      const bill = parseHoBill(data, !write);
      if (bill.bill.id !== id || write && (!bill.bill.voidedAt || bill.paymentState !== "VOID" || bill.bill.version !== command!.expectedVersion + 1)) return fail(502);
      return json({data:bill}, 200);
    } catch { return fail(502); }
  } catch (e) {
    if (e instanceof BoShellGateError || e instanceof TeamAuthError) return fail(e.status);
    if (e instanceof SyntaxError) return fail(400);
    return fail(503);
  }
}
