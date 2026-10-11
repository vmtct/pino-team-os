import type { BoAccessRole, BoLearningSyllabusDetail, BoLearningSyllabusVersion, BoArtSyllabusProfile, BoSyllabusWorksheetMedia } from "./bo-model";
import type { BoAccessRoleDetail, BoAccessSystemUser } from "./bo-access-model";
import type { F3BootstrapState, F3Path } from "./f3-delivery-api";

const PREFIX = "[E2E] PAP-439";
const MANAGER_ROLE_KEY = "manager";
const LEARNING_PERMISSIONS = new Set(["catalog.learning.view", "catalog.learning.manage"]);

export class Pap439HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly requestId: string | null = null) {
    super(requestId ? `${message} [request ${requestId}]` : message);
  }
}

export interface Pap439JsonPort {
  get<T>(path: string): Promise<T>;
  command<T>(method: "POST" | "PATCH", path: string, body: unknown, idempotencyKey?: string): Promise<T>;
}

export interface Pap439ManagerPort extends Pap439JsonPort {
  uploadWorksheetMedia(input: { pathProgramId: string; fileName: string; mimeType: "image/png"; bytes: Uint8Array; idempotencyKey: string }): Promise<BoSyllabusWorksheetMedia>;
}

export function createPap439FetchPort(
  baseUrl = "",
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
  extraHeaders: HeadersInit = {},
): Pap439ManagerPort {
  const root = baseUrl.replace(/\/$/, "");
  const invoke = async <T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown, idempotencyKey?: string): Promise<T> => {
    const headers = new Headers(extraHeaders);
    if (body !== undefined) headers.set("content-type", "application/json");
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    const response = await fetcher(`${root}/api/bo/${path}`, {
      method,
      headers,
      credentials: "include",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let payload: { data?: T; error?: { message?: string; requestId?: string } } = {};
    try { payload = text ? JSON.parse(text) as typeof payload : {}; } catch { /* handled below */ }
    if (!response.ok || payload.data === undefined) {
      throw new Pap439HttpError(response.status, payload.error?.message ?? `PAP-439 BO ${method} ${path} failed (${response.status}).`, response.headers.get("x-request-id") ?? payload.error?.requestId ?? null);
    }
    return payload.data;
  };
  return {
    get: <T>(path: string) => invoke<T>("GET", path),
    command: <T>(method: "POST" | "PATCH", path: string, body: unknown, idempotencyKey?: string) => invoke<T>(method, path, body, idempotencyKey),
    uploadWorksheetMedia: async input => {
      const form = new FormData();
      form.set("pathProgramId", input.pathProgramId);
      const bytes = input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength) as ArrayBuffer;
      form.set("file", new Blob([bytes], { type: input.mimeType }), input.fileName);
      const headers = new Headers(extraHeaders);
      headers.set("idempotency-key", input.idempotencyKey);
      const response = await fetcher(`${root}/api/bo/learning/syllabi/media`, { method: "POST", headers, credentials: "include", body: form });
      const payload = await response.json() as { data?: BoSyllabusWorksheetMedia; error?: { message?: string; requestId?: string } };
      if (!response.ok || payload.data === undefined) throw new Pap439HttpError(response.status, payload.error?.message ?? "PAP-439 worksheet upload failed.", response.headers.get("x-request-id") ?? payload.error?.requestId ?? null);
      return payload.data;
    },
  };
}

export interface Pap439SyllabusFixture {
  runTag: string;
  managerUserId: string;
  managerRoleId: string;
  assignmentId: string;
  path: F3Path;
  foreignPath: F3Path;
  syllabusId: string;
  media: BoSyllabusWorksheetMedia;
  publishedV1: BoLearningSyllabusVersion;
  publishedV2: BoLearningSyllabusVersion;
}

export async function preparePap439SyllabusFixture(
  founder: Pap439JsonPort,
  manager: Pap439ManagerPort,
  input: { runId: string; managerUserId: string; now?: Date },
): Promise<Pap439SyllabusFixture> {
  const runTag = normalizeRunTag(input.runId);
  const now = input.now ?? new Date();
  const managerRole = await requireBoundedManager(founder, input.managerUserId);
  const bootstrap = await founder.get<F3BootstrapState>("delivery/bootstrap-state");
  const pathCode = `e2e-pap439-${runTag}`;
  const foreignCode = `e2e-pap439-${runTag}-foreign`;
  if (bootstrap.paths.some(item => item.code === pathCode || item.code === foreignCode)) throw new Error("PAP-439 run id already has synthetic Path provenance; use cleanup/recovery or a new run id.");

  let path: F3Path | null = null;
  let foreignPath: F3Path | null = null;
  let assignmentId: string | null = null;
  let syllabusId: string | null = null;
  try {
    path = await founder.command<F3Path>("POST", "catalog/paths", { code: pathCode, displayName: `${PREFIX} ${runTag}`, status: "ACTIVE" }, replayKey(runTag, "path-create"));
    foreignPath = await founder.command<F3Path>("POST", "catalog/paths", { code: foreignCode, displayName: `${PREFIX} ${runTag} Foreign`, status: "ACTIVE" }, replayKey(runTag, "foreign-path-create"));
    const assignment = await founder.command<{ id: string }>("POST", "access/assignments", {
      userId: input.managerUserId,
      roleId: managerRole.id,
      scopeType: "PATH",
      scopeId: path.id,
      effectiveFrom: now.toISOString(),
    }, replayKey(runTag, "manager-path-assignment"));
    assignmentId = assignment.id;

    await expectForbidden(() => manager.get(`learning/syllabi/media?pathProgramId=${encodeURIComponent(foreignPath!.id)}`), "foreign Path media list");

    const existing = await manager.get<Array<{ syllabus: { code: string; lifecycle: string } }>>(`learning/syllabi?ownerType=HOUSE_PATH&ownerId=${encodeURIComponent(path.id)}`);
    if (existing.length) throw new Error("PAP-439 fresh synthetic Path unexpectedly already owns Syllabus rows.");

    const created = await manager.command<BoLearningSyllabusDetail>("POST", "learning/syllabi", {
      ownerType: "HOUSE_PATH",
      ownerId: path.id,
      code: `pap439-${runTag}`,
      title: `${PREFIX} ${runTag} V1`,
      shortDescription: "Bounded synthetic Syllabus fixture",
      tags: ["e2e", "pap439"],
      provenance: { fixture: "PAP-439", runTag, pathProgramId: path.id },
    }, replayKey(runTag, "syllabus-create"));
    syllabusId = created.syllabus.id;
    const draftV1 = requireDraft(created, 1);

    const media = await manager.uploadWorksheetMedia({
      pathProgramId: path.id,
      fileName: `pap439-${runTag}.png`,
      mimeType: "image/png",
      bytes: tinyPngBytes(),
      idempotencyKey: replayKey(runTag, "worksheet-upload"),
    });
    if (media.pathProgramId !== path.id) throw new Error("PAP-439 worksheet media lost exact Path provenance.");

    const richContent = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: `${PREFIX} ${runTag}` }] }] };
    await manager.command<BoArtSyllabusProfile>("POST", `learning/syllabi/versions/${draftV1.id}/artchitect-profile`, {
      richContent,
      worksheetMediaIds: [media.mediaAssetId],
      toolTags: ["PAP-439"],
      expectedRevision: null,
    }, replayKey(runTag, "v1-profile"));

    const editedV1 = await manager.command<BoLearningSyllabusVersion>("POST", `learning/syllabi/${syllabusId}/draft`, {
      expectedRevision: draftV1.revision,
      title: `${PREFIX} ${runTag} V1 edited`,
      shortDescription: "Text-only edit preserving worksheet media provenance",
      tags: ["e2e", "pap439", "v1"],
      provenance: { fixture: "PAP-439", runTag, pathProgramId: path.id, version: 1 },
    }, replayKey(runTag, "v1-text-edit"));
    const profileAfterEdit = await manager.get<BoArtSyllabusProfile | null>(`learning/syllabi/versions/${draftV1.id}/artchitect-profile`);
    if (!profileAfterEdit?.worksheetMediaIds.includes(media.mediaAssetId)) throw new Error("PAP-439 text edit did not preserve worksheet media reference.");

    const publishedV1 = await manager.command<BoLearningSyllabusVersion>("POST", `learning/syllabi/${syllabusId}/publish`, { expectedRevision: editedV1.revision }, replayKey(runTag, "v1-publish"));
    if (publishedV1.state !== "PUBLISHED" || publishedV1.versionNumber !== 1) throw new Error("PAP-439 V1 did not publish as exact version 1.");

    const next = await manager.command<BoLearningSyllabusVersion>("POST", `learning/syllabi/${syllabusId}/next-draft`, {}, replayKey(runTag, "v2-next-draft"));
    if (next.state !== "DRAFT" || next.versionNumber !== 2) throw new Error("PAP-439 next-draft did not create exact V2 Draft.");
    const v2Profile = await manager.get<BoArtSyllabusProfile | null>(`learning/syllabi/versions/${next.id}/artchitect-profile`);
    if (!v2Profile) {
      await manager.command<BoArtSyllabusProfile>("POST", `learning/syllabi/versions/${next.id}/artchitect-profile`, {
        richContent,
        worksheetMediaIds: [media.mediaAssetId],
        toolTags: ["PAP-439"],
        expectedRevision: null,
      }, replayKey(runTag, "v2-profile"));
    }
    const editedV2 = await manager.command<BoLearningSyllabusVersion>("POST", `learning/syllabi/${syllabusId}/draft`, {
      expectedRevision: next.revision,
      title: `${PREFIX} ${runTag} V2`,
      shortDescription: "Second published synthetic Syllabus version",
      tags: ["e2e", "pap439", "v2"],
      provenance: { fixture: "PAP-439", runTag, pathProgramId: path.id, version: 2 },
    }, replayKey(runTag, "v2-edit"));
    const publishedV2 = await manager.command<BoLearningSyllabusVersion>("POST", `learning/syllabi/${syllabusId}/publish`, { expectedRevision: editedV2.revision }, replayKey(runTag, "v2-publish"));
    if (publishedV2.state !== "PUBLISHED" || publishedV2.versionNumber !== 2) throw new Error("PAP-439 V2 did not publish as exact version 2.");

    const exactMedia = await manager.get<BoSyllabusWorksheetMedia[]>(`learning/syllabi/media?pathProgramId=${encodeURIComponent(path.id)}`);
    if (!exactMedia.some(item => item.mediaAssetId === media.mediaAssetId && item.pathProgramId === path!.id)) throw new Error("PAP-439 Path-scoped media readback lost exact uploaded media provenance.");

    return { runTag, managerUserId: input.managerUserId, managerRoleId: managerRole.id, assignmentId, path, foreignPath, syllabusId, media, publishedV1, publishedV2 };
  } catch (error) {
    await rollbackPartial(founder, manager, { runTag, path, foreignPath, assignmentId, syllabusId });
    throw error;
  }
}

export async function cleanupPap439SyllabusFixture(founder: Pap439JsonPort, manager: Pap439ManagerPort, fixture: Pap439SyllabusFixture) {
  const detail = await manager.get<BoLearningSyllabusDetail>(`learning/syllabi/${fixture.syllabusId}`);
  if (detail.syllabus.lifecycle === "ACTIVE") {
    await manager.command("POST", `learning/syllabi/${fixture.syllabusId}/archive`, { expectedRevision: detail.syllabus.revision, reason: `${PREFIX} ${fixture.runTag} cleanup` }, replayKey(fixture.runTag, "syllabus-archive"));
  }
  await founder.command("POST", "access/assignments/remove", { assignmentId: fixture.assignmentId }, replayKey(fixture.runTag, "assignment-remove"));
  await archivePaths(founder, fixture.runTag, [fixture.path.id, fixture.foreignPath.id]);
  const finalState = await founder.get<F3BootstrapState>("delivery/bootstrap-state");
  if (finalState.paths.some(item => [fixture.path.id, fixture.foreignPath.id].includes(item.id) && item.status === "ACTIVE")) throw new Error("PAP-439 cleanup left active synthetic Path state.");
  return { cleaned: true as const, retainedMediaAssetId: fixture.media.mediaAssetId, publishedVersionIds: [fixture.publishedV1.id, fixture.publishedV2.id] as const };
}

async function requireBoundedManager(founder: Pap439JsonPort, managerUserId: string): Promise<BoAccessRoleDetail> {
  const [roles, users] = await Promise.all([
    founder.get<BoAccessRole[]>("access/roles"),
    founder.get<BoAccessSystemUser[]>("access/users"),
  ]);
  const role = roles.find(item => item.roleKey.toLowerCase() === MANAGER_ROLE_KEY && item.status === "active");
  if (!role) throw new Error("PAP-439 requires an active system Manager role.");
  const detail = await founder.get<BoAccessRoleDetail>(`access/roles/${role.id}`);
  if (!detail.permissionKeys.includes("catalog.learning.view") || !detail.permissionKeys.includes("catalog.learning.manage")) throw new Error("PAP-439 Manager role lacks canonical Learning Syllabus permissions.");
  const user = users.find(item => item.id === managerUserId && item.status === "active");
  if (!user) throw new Error("PAP-439 requires an active target Manager user.");
  for (const assignment of user.assignments.filter(item => item.scopeType === "GLOBAL")) {
    const globalRole = await founder.get<BoAccessRoleDetail>(`access/roles/${assignment.roleId}`);
    if (globalRole.permissionKeys.some(key => LEARNING_PERMISSIONS.has(key))) throw new Error("PAP-439 refuses a Manager user with GLOBAL Learning Syllabus authority; bounded PATH proof would be bypassed.");
  }
  return detail;
}

async function expectForbidden(action: () => Promise<unknown>, label: string) {
  try { await action(); } catch (error) {
    if (error instanceof Pap439HttpError && error.status === 403) return;
    throw error;
  }
  throw new Error(`PAP-439 expected 403 for ${label}.`);
}

function requireDraft(detail: BoLearningSyllabusDetail, versionNumber: number) {
  const draft = detail.currentDraft;
  if (!draft || draft.state !== "DRAFT" || draft.versionNumber !== versionNumber) throw new Error(`PAP-439 expected current Draft V${versionNumber}.`);
  return draft;
}

async function rollbackPartial(founder: Pap439JsonPort, manager: Pap439ManagerPort, input: { runTag: string; path: F3Path | null; foreignPath: F3Path | null; assignmentId: string | null; syllabusId: string | null }) {
  try {
    if (input.syllabusId && input.assignmentId) {
      const detail = await manager.get<BoLearningSyllabusDetail>(`learning/syllabi/${input.syllabusId}`);
      if (detail.syllabus.lifecycle === "ACTIVE") await manager.command("POST", `learning/syllabi/${input.syllabusId}/archive`, { expectedRevision: detail.syllabus.revision, reason: `${PREFIX} ${input.runTag} rollback` }, replayKey(input.runTag, "rollback-syllabus"));
    }
  } catch { /* preserve original failure; founder cleanup still runs */ }
  if (input.assignmentId) {
    try { await founder.command("POST", "access/assignments/remove", { assignmentId: input.assignmentId }, replayKey(input.runTag, "rollback-assignment")); } catch { /* preserve original failure */ }
  }
  const ids = [input.path?.id, input.foreignPath?.id].filter((value): value is string => Boolean(value));
  if (ids.length) {
    try { await archivePaths(founder, input.runTag, ids); } catch { /* preserve original failure */ }
  }
}

async function archivePaths(founder: Pap439JsonPort, runTag: string, pathIds: string[]) {
  const state = await founder.get<F3BootstrapState>("delivery/bootstrap-state");
  for (const pathId of pathIds) {
    const path = state.paths.find(item => item.id === pathId);
    if (path?.status === "ACTIVE") await founder.command<F3Path>("PATCH", `catalog/paths/${path.id}`, { code: path.code, displayName: path.displayName, status: "ARCHIVED", expectedVersion: path.version }, replayKey(runTag, `archive-path-${path.id}`));
  }
}

function normalizeRunTag(value: string) {
  const tag = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  if (!tag) throw new Error("PAP-439 requires a non-empty run id.");
  return tag;
}

function replayKey(runTag: string, action: string) { return `pap439:${runTag}:${action}`; }

function tinyPngBytes() {
  return Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,13,73,68,65,84,8,215,99,248,207,192,240,31,0,5,0,1,255,137,153,61,29,0,0,0,0,73,69,78,68,174,66,96,130]);
}
