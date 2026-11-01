import { assignmentUuid, parseMissionAssignment, readMissionAssignment, type MissionAssignment } from "./bo-mission-assignments";

/** PAP-1210: headless BO Assignment commands. A success receipt is never
 * considered persisted until an independent authorized Center-scoped GET.
 * The caller owns a single idempotency key; uncertain writes are NOT retried.
 */
export type AssignmentWrite =
  | { kind: "create"; centerId: string; studentId: string; missionId: string;
      contextKey?: string; contextLabel?: string | null; idempotencyKey: string }
  | { kind: "update"; centerId: string; id: string; expectedVersion: number;
      contextLabel: string | null; idempotencyKey: string }
  | { kind: "cancel"; centerId: string; id: string; expectedVersion: number;
      reason: string; idempotencyKey: string };
export type AssignmentOutcome =
  | { state: "verified"; record: MissionAssignment }
  | { state: "invalid" | "denied" | "conflict" | "unverified"; message: string; status?: number; recordId?: string };
const KEY = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,159}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (state: Exclude<AssignmentOutcome["state"], "verified">, message: string,
  status?: number, recordId?: string): AssignmentOutcome =>
  ({ state, message, ...(status !== undefined ? { status } : {}), ...(recordId ? { recordId } : {}) });
function validText(value: string | null | undefined, max: number): boolean {
  return value == null || (typeof value === "string" && !!value.trim() && value.trim().length <= max);
}
function valid(cmd: AssignmentWrite): boolean {
  if (!KEY.test(cmd.idempotencyKey) || !assignmentUuid.test(cmd.centerId)) return false;
  if (cmd.kind === "create") return assignmentUuid.test(cmd.studentId) && assignmentUuid.test(cmd.missionId)
    && validText(cmd.contextKey, 120) && validText(cmd.contextLabel, 200);
  if (!ID.test(cmd.id) || !Number.isSafeInteger(cmd.expectedVersion) || cmd.expectedVersion < 1) return false;
  if (cmd.kind === "update") return validText(cmd.contextLabel, 200);
  return typeof cmd.reason === "string" && !!cmd.reason.trim() && cmd.reason.trim().length <= 500;
}
function payload(cmd: AssignmentWrite) {
  if (cmd.kind === "create") return { centerId: cmd.centerId, studentId: cmd.studentId,
    missionId: cmd.missionId, ...(cmd.contextKey == null ? {} : { contextKey: cmd.contextKey.trim() }),
    ...(cmd.contextLabel === undefined ? {} : { contextLabel: cmd.contextLabel?.trim() ?? null }) };
  if (cmd.kind === "update") return { centerId: cmd.centerId,
    expectedVersion: cmd.expectedVersion, contextLabel: cmd.contextLabel?.trim() ?? null };
  return { centerId: cmd.centerId, expectedVersion: cmd.expectedVersion, reason: cmd.reason.trim() };
}
function consistent(record: MissionAssignment, cmd: AssignmentWrite, p: ReturnType<typeof payload>): boolean {
  if (record.centerId !== cmd.centerId) return false;
  if (cmd.kind === "create") return record.status === "ASSIGNED" &&
    record.studentId === cmd.studentId && record.missionId === cmd.missionId &&
    record.contextKey === ("contextKey" in p ? String(p.contextKey) : "") &&
    record.contextLabel === ("contextLabel" in p ? p.contextLabel : null);
  if (record.id !== cmd.id || record.version !== cmd.expectedVersion + 1) return false;
  if (cmd.kind === "update") return record.status === "ASSIGNED" &&
    record.contextLabel === ("contextLabel" in p ? p.contextLabel : null);
  return record.status === "CANCELLED" && record.cancelledAt !== null &&
    record.cancelledReason === ("reason" in p ? p.reason : null);
}
export async function submitBoMissionAssignment(
  command: AssignmentWrite, fetcher: typeof fetch = fetch, signal = new AbortController().signal,
): Promise<AssignmentOutcome> {
  if (!valid(command)) return fail("invalid", "Center, Mission, Student, version hoặc idempotency không hợp lệ.");
  const p = payload(command);
  const route = "/api/bo/learning/mission-assignments" +
    (command.kind === "create" ? "" : "/" + command.id + (command.kind === "cancel" ? "/cancel" : ""));
  const method = command.kind === "update" ? "PUT" : "POST";
  const url = route + "?" + new URLSearchParams({ centerId: command.centerId });
  let write: Response;
  try {
    write = await fetcher(url, { method, cache: "no-store", credentials: "same-origin", redirect: "error", signal,
      headers: { "content-type": "application/json", "idempotency-key": command.idempotencyKey },
      body: JSON.stringify(p) });
  } catch { return fail("unverified", "Chưa rõ kết quả ghi. Đọc lại Core, không gửi lại tự động."); }
  if ([401, 403, 404].includes(write.status))
    return fail("denied", "Không đủ quyền ghi Nhiệm vụ tại Center.", write.status);
  if (write.status === 409)
    return fail("conflict", "Nhiệm vụ đã thay đổi hoặc trùng; cần đọc lại.", 409);
  if ([400, 413, 422].includes(write.status))
    return fail("invalid", "Dữ liệu Nhiệm vụ không hợp lệ.", write.status);
  if (write.status !== (command.kind === "create" ? 201 : 200))
    return fail("unverified", "Core chưa xác nhận ghi Nhiệm vụ; không gửi lại.", write.status);
  let receipt: MissionAssignment;
  try {
    const body: unknown = await write.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || !("data" in body)) throw Error("Envelope missing");
    receipt = parseMissionAssignment(body.data, command.centerId, command.kind === "create" ? undefined : command.id);
  } catch { return fail("unverified", "Receipt không hợp lệ; đối chiếu Core trước khi thử lại.", write.status); }
  if (!ID.test(receipt.id) || !consistent(receipt, command, p))
    return fail("unverified", "Receipt không khớp thao tác.", write.status, receipt.id);
  let actual: MissionAssignment | null;
  try { actual = await readMissionAssignment(fetcher, command.centerId, receipt.id, signal); }
  catch { return fail("unverified", "Không đọc lại được Core; không gửi lại.", undefined, receipt.id); }
  if (!actual || JSON.stringify(actual) !== JSON.stringify(receipt) || !consistent(actual, command, p))
    return fail("unverified", "Bản ghi Core chưa khớp receipt.", undefined, receipt.id);
  return { state: "verified", record: actual };
}
