/**
 * PAP-1207 (Epic PAP-1188). Headless HO MissionDefinition command adapter.
 * PAP-1247 declarative TDD Action Host will own buttons/form placement and invocation.
 * The frontend never grants permissions: Core/HO gateway reauthorizes every command.
 */
export type MissionInput = Readonly<{
  code: string;
  name: string;
  level: number;
  status: "ACTIVE" | "INACTIVE";
  plsValue: number;
  paperSize: "B5" | "A4" | "A3" | null;
  description: string | null;
  guideline: string | null;
  pathProgramId: string | null;
  pathKeySnapshot: string | null;
  prerequisiteMissionId: string | null;
  prerequisiteCodeSnapshot: string | null;
}>;
type MissionWrite =
  | { kind: "create"; data: MissionInput; idempotencyKey: string }
  | { kind: "update"; id: string; expectedVersion: number; data: MissionInput; idempotencyKey: string }
  | { kind: "archive"; id: string; expectedVersion: number; data: MissionInput; idempotencyKey: string };
type MissionRow = { id: string; code: string; version: number; status: string };
export type MissionCommandOutcome =
  | { state: "verified"; record: MissionRow }
  | { state: "denied" | "invalid" | "conflict" | "unverified"; status?: number; recordId?: string; message: string };
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const idempotencyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,119}$/;
const fields = ["code", "name", "level", "status", "plsValue", "paperSize", "description", "guideline",
  "pathProgramId", "pathKeySnapshot", "prerequisiteMissionId", "prerequisiteCodeSnapshot"] as const;
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function dataOf(value: unknown): Record<string, unknown> | null {
  const envelope = object(value);
  return envelope ? object(envelope.data) : null;
}
function normalized(data: MissionInput, archive: boolean): MissionInput {
  return { ...data, code: data.code.trim().toUpperCase(), name: data.name.trim(),
    status: archive ? "INACTIVE" : data.status };
}
function identity(row: Record<string, unknown> | null, data: MissionInput,
  id?: string): row is Record<string, unknown> & MissionRow {
  return Boolean(row && typeof row.id === "string" && uuidV7.test(row.id) &&
    (!id || row.id === id) && Number.isSafeInteger(row.version) && Number(row.version) >= 1 &&
    fields.every(key => {
      const wanted = data[key];
      const actual = row[key];
      return (wanted ?? null) === (actual ?? null);
    }));
}
function fail(state: Exclude<MissionCommandOutcome["state"], "verified">,
  message: string, status?: number, recordId?: string): MissionCommandOutcome {
  return { state, message, ...(status === undefined ? {} : { status }),
    ...(recordId ? { recordId } : {}) };
}
/**
 * Never auto-replay an uncertain mutation. A 2xx command is only success after
 * an independent authorized Core readback confirms exact identity and version.
 */
export async function submitHoMission(
  command: MissionWrite, fetcher: typeof fetch = fetch, signal?: AbortSignal,
): Promise<MissionCommandOutcome> {
  if (!idempotencyPattern.test(command.idempotencyKey) ||
      (command.kind !== "create" && (!uuidV7.test(command.id) ||
        !Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 1)))
    return fail("invalid", "Mission ID, version hoặc idempotency không hợp lệ.");
  const wanted = normalized(command.data, command.kind === "archive");
  const method = command.kind === "create" ? "POST" : "PUT";
  const route = "/api/ho/learning/missions" + (command.kind === "create" ? "" : "/" + command.id);
  const payload = { ...wanted,
    ...(command.kind === "create" ? {} : { expectedVersion: command.expectedVersion }) };
  let result: Response;
  try {
    result = await fetcher(route, {
      method, credentials: "same-origin", cache: "no-store", redirect: "error", signal,
      headers: { "content-type": "application/json", "idempotency-key": command.idempotencyKey },
      body: JSON.stringify(payload),
    });
  } catch {
    return fail("unverified", "Chưa xác minh kết quả ghi. Đọc lại Core trước khi gửi lại.");
  }
  if (result.status === 401 || result.status === 403 || result.status === 404)
    return fail("denied", "Phiên hoặc quyền GLOBAL Founder không hợp lệ.", result.status);
  if (result.status === 409)
    return fail("conflict", "Mission đã thay đổi; tải lại phiên bản hiện tại.", 409);
  if (result.status === 400 || result.status === 413 || result.status === 422)
    return fail("invalid", "Dữ liệu Mission bị từ chối.", result.status);
  if (result.status !== (method === "POST" ? 201 : 200))
    return fail("unverified", "Core chưa xác nhận kết quả ghi; không gửi lại tự động.", result.status);
  let receipt: Record<string, unknown> | null;
  try { receipt = dataOf(await result.json()); }
  catch { receipt = null; }
  const id = typeof receipt?.id === "string" && uuidV7.test(receipt.id) ? receipt.id : null;
  if (!id || (command.kind !== "create" && id !== command.id) ||
      !identity(receipt, wanted, id))
    return fail("unverified", "Receipt Mission không hợp lệ; đối chiếu Core trước khi thử lại.", result.status, id ?? undefined);
  if (command.kind !== "create" && Number(receipt!.version) !== command.expectedVersion + 1)
    return fail("unverified", "Version ghi Mission chưa được xác minh.", result.status, id);
  let read: Response;
  try {
    read = await fetcher("/api/ho/learning/missions/" + id, {
      method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
    });
  } catch {
    return fail("unverified", "Đã nhận receipt nhưng không đọc lại được Core; không gửi lại.", undefined, id);
  }
  if (!read.ok)
    return fail("unverified", "Readback Core chưa khả dụng; không gửi lại.", read.status, id);
  let record: Record<string, unknown> | null;
  try { record = dataOf(await read.json()); }
  catch { record = null; }
  if (!identity(record, wanted, id) || record!.version !== receipt!.version)
    return fail("unverified", "Readback Core chưa khớp Mission; không gửi lại.", read.status, id);
  return { state: "verified", record: { id, code: String(record!.code),
    status: String(record!.status), version: Number(record!.version) } };
}
