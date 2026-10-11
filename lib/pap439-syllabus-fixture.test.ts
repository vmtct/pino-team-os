import test from "node:test";
import assert from "node:assert/strict";
import { cleanupPap439SyllabusFixture, Pap439HttpError, preparePap439SyllabusFixture, type Pap439ManagerPort } from "./pap439-syllabus-fixture";
import type { F3Path } from "./f3-delivery-api";
import type { BoLearningSyllabusDetail, BoLearningSyllabusVersion, BoSyllabusWorksheetMedia } from "./bo-model";

const managerUserId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const managerRoleId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";

type StoredMedia = BoSyllabusWorksheetMedia & { bytes: Uint8Array };
type SharedState = { managerPathId: string | null; media: Map<string, StoredMedia>; nextMedia: number; syllabus: { id: string; code: string; ownerId: string; lifecycle: "ACTIVE" | "ARCHIVED"; revision: number } | null };

function sharedState(): SharedState { return { managerPathId: null, media: new Map(), nextMedia: 1, syllabus: null }; }

function bootstrap(paths: F3Path[]) {
  return {
    asOf: "2026-10-11T12:00:00.000Z",
    centers: [], paths, learningSpaces: [], activeLearningSpaces: [], runningClasses: [], activeRunningClasses: [],
    runningClassBlocks: [], terms: [], termWeeks: [], upcomingSessions: [], materializationPolicyStreams: [],
  };
}

class FounderFake implements Pap439ManagerPort {
  paths: F3Path[] = [];
  assignments = new Map<string, { assignmentId: string; roleId: string; scopeType: "PATH"; scopeId: string; effectiveFrom: string; effectiveUntil: null }>();
  commands: string[] = [];
  failRemoveAfterCommitOnce = false;
  failArchiveAfterCommitOnceFor: string | null = null;

  constructor(private readonly shared: SharedState, private readonly globalPermission: string | null = null, private readonly managerPermissions = ["catalog.learning.view", "catalog.learning.manage", "catalog.learning.publish"]) {}

  async get<T>(path: string): Promise<T> {
    if (path === "access/roles") return [{ id: managerRoleId, roleKey: "manager", displayName: "Manager", roleType: "system", status: "active", description: null, permissionCount: this.managerPermissions.length, assignmentCount: this.assignments.size }] as T;
    if (path === `access/roles/${managerRoleId}`) return { id: managerRoleId, roleKey: "manager", displayName: "Manager", roleType: "system", status: "active", description: null, permissionCount: this.managerPermissions.length, assignmentCount: this.assignments.size, createdAt: "x", updatedAt: "x", permissionKeys: this.managerPermissions } as T;
    if (path === "access/roles/global-learning") return { id: "global-learning", roleKey: "global-learning", displayName: "Global Learning", roleType: "custom", status: "active", description: null, permissionCount: 1, assignmentCount: 1, createdAt: "x", updatedAt: "x", permissionKeys: [this.globalPermission] } as T;
    if (path === "access/users") {
      const pathAssignments = [...this.assignments.values()].map(item => ({ ...item, roleKey: "manager", roleName: "Manager" }));
      const globalAssignments = this.globalPermission ? [{ assignmentId: "global-a", roleId: "global-learning", roleKey: "global-learning", roleName: "Global Learning", scopeType: "GLOBAL", scopeId: null, effectiveFrom: "2026-01-01T00:00:00Z", effectiveUntil: null }] : [];
      return [{ id: managerUserId, staffMemberId: "staff-1", status: "active", email: "manager@example.test", assignments: [...globalAssignments, ...pathAssignments] }] as T;
    }
    if (path === "delivery/bootstrap-state") return bootstrap(this.paths) as T;
    if (path.startsWith("learning/syllabi?ownerType=HOUSE_PATH")) {
      const ownerId = decodeURIComponent(path.split("ownerId=")[1]!);
      const row = this.shared.syllabus;
      return (row && row.ownerId === ownerId ? [{ syllabus: { id: row.id, owner: { type: "HOUSE_PATH", id: row.ownerId }, code: row.code, lifecycle: row.lifecycle, revision: row.revision } }] : []) as T;
    }
    if (this.shared.syllabus && path === `learning/syllabi/${this.shared.syllabus.id}`) {
      const row = this.shared.syllabus;
      return detail(row.id, row.code, row.ownerId, row.lifecycle, row.revision, null, null) as T;
    }
    throw new Error(`Founder GET not mocked: ${path}`);
  }

  async command<T>(method: "POST" | "PATCH", path: string, body: any): Promise<T> {
    this.commands.push(`${method} ${path}`);
    if (method === "POST" && path === "catalog/paths") {
      const created: F3Path = { id: `path-${this.paths.length + 1}`, code: body.code, displayName: body.displayName, status: "ACTIVE", version: 1 };
      this.paths.push(created);
      return created as T;
    }
    if (method === "PATCH" && path.startsWith("catalog/paths/")) {
      const id = path.split("/").at(-1)!;
      const current = this.paths.find(item => item.id === id)!;
      Object.assign(current, { status: body.status, version: current.version + 1 });
      if (this.failArchiveAfterCommitOnceFor === id) {
        this.failArchiveAfterCommitOnceFor = null;
        throw new Error("simulated lost Path archive response");
      }
      return current as T;
    }
    if (method === "POST" && path === "access/assignments") {
      assert.equal(body.userId, managerUserId); assert.equal(body.roleId, managerRoleId); assert.equal(body.scopeType, "PATH");
      const assignment = { assignmentId: "assignment-pap439", roleId: managerRoleId, scopeType: "PATH" as const, scopeId: body.scopeId, effectiveFrom: body.effectiveFrom, effectiveUntil: null };
      this.assignments.set(assignment.assignmentId, assignment);
      this.shared.managerPathId = body.scopeId;
      return { id: assignment.assignmentId } as T;
    }
    if (method === "POST" && this.shared.syllabus && path === `learning/syllabi/${this.shared.syllabus.id}/archive`) {
      this.shared.syllabus.lifecycle = "ARCHIVED"; this.shared.syllabus.revision += 1;
      return { id: this.shared.syllabus.id, lifecycle: "ARCHIVED" } as T;
    }
    if (method === "POST" && path === "access/assignments/remove") {
      this.assignments.delete(body.assignmentId);
      this.shared.managerPathId = null;
      if (this.failRemoveAfterCommitOnce) {
        this.failRemoveAfterCommitOnce = false;
        throw new Error("simulated lost assignment-remove response");
      }
      return { assignmentId: body.assignmentId, status: "REMOVED" } as T;
    }
    throw new Error(`Founder command not mocked: ${method} ${path}`);
  }

  async uploadWorksheetMedia(input: { pathProgramId: string; fileName: string; mimeType: "image/png"; bytes: Uint8Array; idempotencyKey: string }): Promise<BoSyllabusWorksheetMedia> {
    const media: StoredMedia = { mediaAssetId: `media-${this.shared.nextMedia++}`, mimeType: input.mimeType, byteSize: input.bytes.length, createdAt: "x", fileName: input.fileName, pathProgramId: input.pathProgramId, bytes: input.bytes };
    this.shared.media.set(media.mediaAssetId, media);
    return media;
  }

  async previewWorksheetMedia(input: { mediaAssetId: string; pathProgramId: string }): Promise<{ mimeType: string; bytes: ArrayBuffer }> {
    const media = this.shared.media.get(input.mediaAssetId);
    if (!media || media.pathProgramId !== input.pathProgramId) throw new Pap439HttpError(403, "forbidden");
    return { mimeType: media.mimeType, bytes: media.bytes.buffer.slice(media.bytes.byteOffset, media.bytes.byteOffset + media.bytes.byteLength) as ArrayBuffer };
  }
}

class ManagerFake implements Pap439ManagerPort {
  syllabusLifecycle: "ACTIVE" | "ARCHIVED" = "ACTIVE";
  syllabusRevision = 1;
  syllabusId: string | null = null;
  syllabusCode: string | null = null;
  allowForeign = false;
  publishCount = 0;

  constructor(private readonly shared: SharedState) {}

  async get<T>(path: string): Promise<T> {
    if (path.startsWith("learning/syllabi/media?pathProgramId=")) {
      const id = decodeURIComponent(path.split("=")[1]!);
      if (id !== this.shared.managerPathId && !this.allowForeign) throw new Pap439HttpError(403, "forbidden");
      return [...this.shared.media.values()].filter(item => item.pathProgramId === id) as T;
    }
    if (path.startsWith("learning/syllabi?ownerType=HOUSE_PATH")) {
      const ownerId = decodeURIComponent(path.split("ownerId=")[1]!);
      if (ownerId !== this.shared.managerPathId && !this.allowForeign) throw new Pap439HttpError(403, "forbidden");
      if (!this.syllabusId || ownerId !== this.shared.managerPathId) return [] as T;
      return [{ syllabus: { id: this.syllabusId, owner: { type: "HOUSE_PATH", id: ownerId }, code: this.syllabusCode, lifecycle: this.syllabusLifecycle, revision: this.syllabusRevision } }] as T;
    }
    if (this.syllabusId && path === `learning/syllabi/${this.syllabusId}`) return detail(this.syllabusId, this.syllabusCode!, this.shared.managerPathId!, this.syllabusLifecycle, this.syllabusRevision, null, null) as T;
    throw new Error(`Manager GET not mocked: ${path}`);
  }

  async command<T>(method: "POST" | "PATCH", path: string, body: any): Promise<T> {
    assert.equal(method, "POST");
    if (path === "learning/syllabi") {
      assert.equal(body.ownerId, this.shared.managerPathId);
      this.syllabusId = "syllabus-1"; this.syllabusCode = body.code; this.syllabusLifecycle = "ACTIVE"; this.syllabusRevision = 1; this.publishCount = 0;
      this.shared.syllabus = { id: this.syllabusId, code: body.code, ownerId: body.ownerId, lifecycle: "ACTIVE", revision: 1 };
      const draft = version("v1", 1, "DRAFT", 1, body.title);
      return detail(this.syllabusId, body.code, body.ownerId, "ACTIVE", 1, draft, null) as T;
    }
    if (path === "learning/syllabi/syllabus-1/draft") {
      if (body.title.includes("V1")) return version("v1", 1, "DRAFT", body.expectedRevision + 1, body.title) as T;
      return version("v2", 2, "DRAFT", body.expectedRevision + 1, body.title) as T;
    }
    if (path === "learning/syllabi/syllabus-1/publish") {
      this.publishCount += 1;
      if (this.publishCount === 1) return version("v1", 1, "PUBLISHED", body.expectedRevision + 1, "V1") as T;
      return version("v2", 2, "PUBLISHED", body.expectedRevision + 1, "V2") as T;
    }
    if (path === "learning/syllabi/syllabus-1/next-draft") return version("v2", 2, "DRAFT", 1, "V2 draft") as T;
    if (path === "learning/syllabi/syllabus-1/archive") {
      this.syllabusLifecycle = "ARCHIVED"; this.syllabusRevision += 1;
      if (this.shared.syllabus) { this.shared.syllabus.lifecycle = "ARCHIVED"; this.shared.syllabus.revision = this.syllabusRevision; }
      return { id: "syllabus-1", lifecycle: "ARCHIVED" } as T;
    }
    throw new Error(`Manager command not mocked: ${method} ${path}`);
  }

  async uploadWorksheetMedia(input: { pathProgramId: string; fileName: string; mimeType: "image/png"; bytes: Uint8Array; idempotencyKey: string }): Promise<BoSyllabusWorksheetMedia> {
    if (input.pathProgramId !== this.shared.managerPathId) throw new Pap439HttpError(403, "forbidden");
    const media: StoredMedia = { mediaAssetId: `media-${this.shared.nextMedia++}`, mimeType: input.mimeType, byteSize: input.bytes.length, createdAt: "x", fileName: input.fileName, pathProgramId: input.pathProgramId, bytes: input.bytes };
    this.shared.media.set(media.mediaAssetId, media);
    return media;
  }

  async previewWorksheetMedia(input: { mediaAssetId: string; pathProgramId: string }): Promise<{ mimeType: string; bytes: ArrayBuffer }> {
    const media = this.shared.media.get(input.mediaAssetId);
    if (!media) throw new Pap439HttpError(404, "not found");
    if (!this.allowForeign && (input.pathProgramId !== this.shared.managerPathId || media.pathProgramId !== input.pathProgramId)) throw new Pap439HttpError(403, "forbidden");
    return { mimeType: media.mimeType, bytes: media.bytes.buffer.slice(media.bytes.byteOffset, media.bytes.byteOffset + media.bytes.byteLength) as ArrayBuffer };
  }
}

function version(id: string, versionNumber: number, state: "DRAFT" | "PUBLISHED", revision: number, title: string): BoLearningSyllabusVersion {
  return { id, syllabusId: "syllabus-1", versionNumber, state, title, shortDescription: null, publicDescription: null, tags: [], thumbnailMediaId: null, coverMediaId: null, sourceType: null, sourceRef: null, provenance: null, revision, createdByUserId: managerUserId, createdAt: "x", updatedAt: "x", publishedByUserId: state === "PUBLISHED" ? managerUserId : null, publishedAt: state === "PUBLISHED" ? "x" : null };
}

function detail(id: string, code: string, ownerId: string, lifecycle: "ACTIVE" | "ARCHIVED", revision: number, currentDraft: BoLearningSyllabusVersion | null, latestPublished: BoLearningSyllabusVersion | null): BoLearningSyllabusDetail {
  return { syllabus: { id, owner: { type: "HOUSE_PATH", id: ownerId }, code, lifecycle, revision, createdByUserId: managerUserId, createdAt: "x", archivedByUserId: lifecycle === "ARCHIVED" ? managerUserId : null, archivedAt: lifecycle === "ARCHIVED" ? "x" : null, archiveReason: lifecycle === "ARCHIVED" ? "cleanup" : null }, versions: [currentDraft, latestPublished].filter(Boolean) as BoLearningSyllabusVersion[], currentDraft, latestPublished };
}

test("PAP-439 proves bounded PATH Syllabus V1→V2 plus positive/foreign media provenance and cleans state", async () => {
  const shared = sharedState(); const founder = new FounderFake(shared); const manager = new ManagerFake(shared);
  const fixture = await preparePap439SyllabusFixture(founder, manager, { runId: "run-001", managerUserId, now: new Date("2026-10-11T12:00:00Z") });
  assert.equal(fixture.path.status, "ACTIVE"); assert.equal(fixture.publishedV1.versionNumber, 1); assert.equal(fixture.publishedV2.versionNumber, 2);
  assert.equal(fixture.media.pathProgramId, fixture.path.id); assert.equal(fixture.foreignMedia.pathProgramId, fixture.foreignPath.id);
  assert.deepEqual([...founder.assignments.keys()], [fixture.assignmentId]);
  const cleanup = await cleanupPap439SyllabusFixture(founder, manager, fixture);
  assert.equal(cleanup.cleaned, true); assert.equal(founder.assignments.size, 0); assert.ok(founder.paths.every(item => item.status === "ARCHIVED")); assert.equal(manager.syllabusLifecycle, "ARCHIVED");
});

test("PAP-439 requires publish permission and rejects GLOBAL publish-only authority before topology mutation", async () => {
  const missingShared = sharedState(); const missingPublish = new FounderFake(missingShared, null, ["catalog.learning.view", "catalog.learning.manage"]);
  await assert.rejects(() => preparePap439SyllabusFixture(missingPublish, new ManagerFake(missingShared), { runId: "run-missing-publish", managerUserId }), /catalog\.learning\.publish/);
  assert.equal(missingPublish.paths.length, 0);

  const globalShared = sharedState(); const globalPublish = new FounderFake(globalShared, "catalog.learning.publish");
  await assert.rejects(() => preparePap439SyllabusFixture(globalPublish, new ManagerFake(globalShared), { runId: "run-global-publish", managerUserId }), /GLOBAL Learning Syllabus authority/);
  assert.equal(globalPublish.paths.length, 0); assert.equal(globalPublish.assignments.size, 0);
});

test("PAP-439 fails closed and rolls back when foreign media preview/provenance becomes readable", async () => {
  const shared = sharedState(); const founder = new FounderFake(shared); const manager = new ManagerFake(shared); manager.allowForeign = true;
  await assert.rejects(() => preparePap439SyllabusFixture(founder, manager, { runId: "run-leak", managerUserId }), /expected 403/);
  assert.equal(founder.assignments.size, 0); assert.ok(founder.paths.every(item => item.status === "ARCHIVED"));
});

test("PAP-439 cleanup is resumable when a Path archive commits but its response is lost", async () => {
  const shared = sharedState(); const founder = new FounderFake(shared); const manager = new ManagerFake(shared);
  const fixture = await preparePap439SyllabusFixture(founder, manager, { runId: "run-retry-path", managerUserId });
  founder.failArchiveAfterCommitOnceFor = fixture.path.id;
  await assert.rejects(() => cleanupPap439SyllabusFixture(founder, manager, fixture), /terminal synthetic state/);
  assert.equal(founder.assignments.size, 1, "authority must remain until Path archival is proven");
  const retry = await cleanupPap439SyllabusFixture(founder, manager, fixture);
  assert.equal(retry.cleaned, true); assert.equal(founder.assignments.size, 0); assert.ok(founder.paths.every(item => item.status === "ARCHIVED"));
});

test("PAP-439 cleanup reconciles a committed assignment removal whose response was lost", async () => {
  const shared = sharedState(); const founder = new FounderFake(shared); const manager = new ManagerFake(shared);
  const fixture = await preparePap439SyllabusFixture(founder, manager, { runId: "run-retry-assignment", managerUserId });
  founder.failRemoveAfterCommitOnce = true;
  await assert.rejects(() => cleanupPap439SyllabusFixture(founder, manager, fixture), /terminal synthetic state/);
  assert.equal(founder.assignments.size, 0, "simulated mutation committed before response loss");
  const retry = await cleanupPap439SyllabusFixture(founder, manager, fixture);
  assert.equal(retry.cleaned, true); assert.ok(founder.paths.every(item => item.status === "ARCHIVED"));
});
