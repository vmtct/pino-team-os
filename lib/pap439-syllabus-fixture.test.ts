import test from "node:test";
import assert from "node:assert/strict";
import { cleanupPap439SyllabusFixture, Pap439HttpError, preparePap439SyllabusFixture, type Pap439JsonPort, type Pap439ManagerPort } from "./pap439-syllabus-fixture";
import type { F3Path } from "./f3-delivery-api";
import type { BoArtSyllabusProfile, BoLearningSyllabusDetail, BoLearningSyllabusVersion, BoSyllabusWorksheetMedia } from "./bo-model";

const managerUserId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const managerRoleId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";

function bootstrap(paths: F3Path[]) {
  return {
    asOf: "2026-10-11T12:00:00.000Z",
    centers: [],
    paths,
    learningSpaces: [],
    activeLearningSpaces: [],
    runningClasses: [],
    activeRunningClasses: [],
    runningClassBlocks: [],
    terms: [],
    termWeeks: [],
    upcomingSessions: [],
    materializationPolicyStreams: [],
  };
}

class FounderFake implements Pap439JsonPort {
  paths: F3Path[] = [];
  assignments = new Set<string>();
  commands: string[] = [];
  constructor(private globalLearning = false) {}

  async get<T>(path: string): Promise<T> {
    if (path === "access/roles") return [{ id: managerRoleId, roleKey: "manager", displayName: "Manager", roleType: "system", status: "active", description: null, permissionCount: 2, assignmentCount: 0 }] as T;
    if (path === `access/roles/${managerRoleId}`) return { id: managerRoleId, roleKey: "manager", displayName: "Manager", roleType: "system", status: "active", description: null, permissionCount: 2, assignmentCount: 0, createdAt: "x", updatedAt: "x", permissionKeys: ["catalog.learning.view", "catalog.learning.manage"] } as T;
    if (path === "access/roles/global-learning") return { id: "global-learning", roleKey: "global-learning", displayName: "Global Learning", roleType: "custom", status: "active", description: null, permissionCount: 1, assignmentCount: 1, createdAt: "x", updatedAt: "x", permissionKeys: ["catalog.learning.manage"] } as T;
    if (path === "access/users") return [{ id: managerUserId, staffMemberId: "staff-1", status: "active", email: "manager@example.test", assignments: this.globalLearning ? [{ assignmentId: "global-a", roleId: "global-learning", roleKey: "global-learning", roleName: "Global Learning", scopeType: "GLOBAL", scopeId: null, effectiveFrom: "2026-01-01T00:00:00Z", effectiveUntil: null }] : [] }] as T;
    if (path === "delivery/bootstrap-state") return bootstrap(this.paths) as T;
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
      return current as T;
    }
    if (method === "POST" && path === "access/assignments") {
      assert.equal(body.userId, managerUserId);
      assert.equal(body.roleId, managerRoleId);
      assert.equal(body.scopeType, "PATH");
      const id = "assignment-pap439";
      this.assignments.add(id);
      return { id } as T;
    }
    if (method === "POST" && path === "access/assignments/remove") {
      this.assignments.delete(body.assignmentId);
      return { assignmentId: body.assignmentId, status: "REMOVED" } as T;
    }
    throw new Error(`Founder command not mocked: ${method} ${path}`);
  }
}

class ManagerFake implements Pap439ManagerPort {
  pathId: string | null = null;
  foreignPathId: string | null = null;
  syllabusLifecycle: "ACTIVE" | "ARCHIVED" = "ACTIVE";
  syllabusRevision = 1;
  profiles = new Map<string, BoArtSyllabusProfile>();
  media: BoSyllabusWorksheetMedia | null = null;
  allowForeign = false;

  async get<T>(path: string): Promise<T> {
    if (path.startsWith("learning/syllabi/media?pathProgramId=")) {
      const id = decodeURIComponent(path.split("=")[1]!);
      if ((this.pathId === null || id !== this.pathId) && !this.allowForeign) throw new Pap439HttpError(403, "forbidden");
      return (this.media && id === this.pathId ? [this.media] : []) as T;
    }
    if (path.startsWith("learning/syllabi?ownerType=HOUSE_PATH")) return [] as T;
    if (path.includes("/artchitect-profile")) {
      const versionId = path.split("/")[3]!;
      return (this.profiles.get(versionId) ?? null) as T;
    }
    if (path === "learning/syllabi/syllabus-1") return detail("syllabus-1", this.syllabusLifecycle, this.syllabusRevision, null, null) as T;
    throw new Error(`Manager GET not mocked: ${path}`);
  }

  async command<T>(method: "POST" | "PATCH", path: string, body: any): Promise<T> {
    assert.equal(method, "POST");
    if (path === "learning/syllabi") {
      this.pathId = body.ownerId;
      const draft = version("v1", 1, "DRAFT", 1, body.title);
      return detail("syllabus-1", "ACTIVE", 1, draft, null) as T;
    }
    if (path === "learning/syllabi/syllabus-1/draft") {
      if (body.title.includes("V1")) return version("v1", 1, "DRAFT", body.expectedRevision + 1, body.title) as T;
      return version("v2", 2, "DRAFT", body.expectedRevision + 1, body.title) as T;
    }
    if (path === "learning/syllabi/syllabus-1/publish") {
      if (body.expectedRevision === 2 && !this.profiles.has("v2")) return version("v1", 1, "PUBLISHED", 2, "V1") as T;
      return version("v2", 2, "PUBLISHED", body.expectedRevision, "V2") as T;
    }
    if (path === "learning/syllabi/syllabus-1/next-draft") return version("v2", 2, "DRAFT", 1, "V2 draft") as T;
    if (path.endsWith("/artchitect-profile")) {
      const versionId = path.split("/")[3]!;
      const profile: BoArtSyllabusProfile = { syllabusVersionId: versionId, richContent: body.richContent, toolTags: body.toolTags, worksheetMediaIds: body.worksheetMediaIds, revision: 1, updatedAt: "x" };
      this.profiles.set(versionId, profile);
      return profile as T;
    }
    if (path === "learning/syllabi/syllabus-1/archive") {
      this.syllabusLifecycle = "ARCHIVED";
      this.syllabusRevision += 1;
      return { id: "syllabus-1", lifecycle: "ARCHIVED" } as T;
    }
    throw new Error(`Manager command not mocked: ${method} ${path}`);
  }

  async uploadWorksheetMedia(input: { pathProgramId: string; fileName: string; mimeType: "image/png"; bytes: Uint8Array; idempotencyKey: string }): Promise<BoSyllabusWorksheetMedia> {
    assert.ok(input.bytes.length > 20);
    this.pathId = input.pathProgramId;
    this.media = { mediaAssetId: "media-1", mimeType: "image/png", byteSize: input.bytes.length, createdAt: "x", fileName: input.fileName, pathProgramId: input.pathProgramId };
    return this.media;
  }
}

function version(id: string, versionNumber: number, state: "DRAFT" | "PUBLISHED", revision: number, title: string): BoLearningSyllabusVersion {
  return { id, syllabusId: "syllabus-1", versionNumber, state, title, shortDescription: null, publicDescription: null, tags: [], thumbnailMediaId: null, coverMediaId: null, sourceType: null, sourceRef: null, provenance: null, revision, createdByUserId: managerUserId, createdAt: "x", updatedAt: "x", publishedByUserId: state === "PUBLISHED" ? managerUserId : null, publishedAt: state === "PUBLISHED" ? "x" : null };
}

function detail(id: string, lifecycle: "ACTIVE" | "ARCHIVED", revision: number, currentDraft: BoLearningSyllabusVersion | null, latestPublished: BoLearningSyllabusVersion | null): BoLearningSyllabusDetail {
  return { syllabus: { id, owner: { type: "HOUSE_PATH", id: "path-1" }, code: "pap439-test", lifecycle, revision, createdByUserId: managerUserId, createdAt: "x", archivedByUserId: lifecycle === "ARCHIVED" ? managerUserId : null, archivedAt: lifecycle === "ARCHIVED" ? "x" : null, archiveReason: lifecycle === "ARCHIVED" ? "cleanup" : null }, versions: [currentDraft, latestPublished].filter(Boolean) as BoLearningSyllabusVersion[], currentDraft, latestPublished };
}

test("PAP-439 prepares bounded PATH Manager Syllabus/media V1→V2 and cleans effective state", async () => {
  const founder = new FounderFake();
  const manager = new ManagerFake();
  const fixture = await preparePap439SyllabusFixture(founder, manager, { runId: "run-001", managerUserId, now: new Date("2026-10-11T12:00:00Z") });

  assert.equal(fixture.path.status, "ACTIVE");
  assert.equal(fixture.publishedV1.versionNumber, 1);
  assert.equal(fixture.publishedV2.versionNumber, 2);
  assert.equal(fixture.media.pathProgramId, fixture.path.id);
  assert.ok(manager.profiles.get("v1")?.worksheetMediaIds.includes("media-1"));
  assert.ok(manager.profiles.get("v2")?.worksheetMediaIds.includes("media-1"));
  assert.deepEqual([...founder.assignments], [fixture.assignmentId]);

  const cleanup = await cleanupPap439SyllabusFixture(founder, manager, fixture);
  assert.equal(cleanup.cleaned, true);
  assert.equal(founder.assignments.size, 0);
  assert.ok(founder.paths.every(item => item.status === "ARCHIVED"));
  assert.equal(manager.syllabusLifecycle, "ARCHIVED");
});

test("PAP-439 rejects target Manager with GLOBAL Learning authority before topology mutation", async () => {
  const founder = new FounderFake(true);
  const manager = new ManagerFake();
  await assert.rejects(() => preparePap439SyllabusFixture(founder, manager, { runId: "run-global", managerUserId }), /GLOBAL Learning Syllabus authority/);
  assert.equal(founder.paths.length, 0);
  assert.equal(founder.assignments.size, 0);
});

test("PAP-439 fails closed and rolls back when foreign Path media is unexpectedly readable", async () => {
  const founder = new FounderFake();
  const manager = new ManagerFake();
  manager.allowForeign = true;
  await assert.rejects(() => preparePap439SyllabusFixture(founder, manager, { runId: "run-leak", managerUserId }), /expected 403/);
  assert.equal(founder.assignments.size, 0);
  assert.ok(founder.paths.every(item => item.status === "ARCHIVED"));
});
