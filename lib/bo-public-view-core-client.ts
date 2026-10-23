/**
 * PAP-887 — strict, injectible Core PAP-886 HTTP transport for shared BO Saved Views.
 *
 * No browser storage, token discovery, optimistic retry or implicit permission
 * elevation. UI must obtain bearer/surface authority from the existing BO session.
 * Core separately enforces module read permissions and shared-view manage grants.
 */
import {
  validateBoViewConfig, type BoPublicView, type BoViewConfig, type BoViewWrite, type BoViewRole,
} from "./bo-public-view-state";
import type { BoViewUpdateIntent } from "./bo-public-view-update-queue";

export class BoPublicViewHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: "conflict" | "unauthorized" | "forbidden" | "not_found" | "rejected" | "invalid_response",
  ) {
    super(`Shared BO View ${reason}`);
    this.name = "BoPublicViewHttpError";
  }
}

export type BoViewCoreOptions = {
  /** BO surface-routed Core origin. Production must not trust synthetic surface headers. */
  baseUrl: string;
  moduleKey: string;
  allowedFields: readonly string[];
  /** The authenticated BO access context is managed externally. */
  role: BoViewRole;
  bearer?: () => Promise<string> | string;
  /** Explicit same-origin BO BFF transport; cookie remains HttpOnly. */
  authMode?: "core_bearer" | "team_cookie";
  fetchImpl?: typeof fetch;
};
type CoreRow = {
  id: unknown; moduleKey: unknown; name: unknown; position: unknown;
  version: unknown; config: unknown;
};
const SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireSegment(value: string, what: string): string {
  if (typeof value !== "string" || !SEGMENT.test(value)) throw new Error(`Invalid ${what}`);
  return value;
}
function parseRow(raw: unknown, moduleKey: string, fields: readonly string[]): BoPublicView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BoPublicViewHttpError(502, "invalid_response");
  }
  const row = raw as CoreRow;
  if (typeof row.id !== "string" || !UUID.test(row.id) ||
    row.moduleKey !== moduleKey ||
    typeof row.name !== "string" || row.name.trim().length < 1 || row.name.length > 80 ||
    typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1 ||
    typeof row.position !== "number" || !Number.isSafeInteger(row.position) || row.position < 0) {
    throw new BoPublicViewHttpError(502, "invalid_response");
  }
  let config: BoViewConfig;
  try { config = validateBoViewConfig(row.config as BoViewConfig, fields); }
  catch { throw new BoPublicViewHttpError(502, "invalid_response"); }
  return { id: row.id, moduleKey, name: row.name, position: row.position, version: row.version, config };
}

function validBase(baseUrl: string): URL {
  const url = new URL(baseUrl);
  if (url.username || url.password || url.hash || url.search || url.pathname !== "/") {
    throw new Error("Use a canonical Core API origin without path, query or embedded credentials");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("Core API origin must be HTTPS outside local development");
  }
  return url;
}

/**
 * Each operation is one transport attempt. Rejection and uncertainty are left to
 * the state queue/user; no automatic retries, even for ambiguous network errors.
 */
export class BoPublicViewCoreClient {
  private readonly base: URL;
  private readonly fields: readonly string[];
  private readonly options: BoViewCoreOptions;
  constructor(options: BoViewCoreOptions) {
    this.base = validBase(options.baseUrl);
    requireSegment(options.moduleKey, "module key");
    if (options.role !== "staff" && options.role !== "manager") throw new Error("Invalid BO view role");
    if (!options.allowedFields.length) throw new Error("Missing BO module schema");
    this.fields = [...options.allowedFields];
    this.options = options;
  }
  private requireManager() {
    if (this.options.role !== "manager") throw new Error("Staff can modify only a transient local view draft");
  }
  private async call(path: string, method: string, input?: unknown): Promise<unknown> {
    const cookieMode = this.options.authMode === "team_cookie";
    if (cookieMode && (typeof window === "undefined" || new URL(window.location.href).origin !== this.base.origin)) {
      throw new Error("BO cookie transport requires a same-origin browser session");
    }
    const token = cookieMode ? null : await this.options.bearer?.();
    if (!cookieMode && (!token || typeof token !== "string" || /[\r\n]/.test(token))) {
      throw new BoPublicViewHttpError(401, "unauthorized");
    }
    const endpoint = new URL(path, this.base);
    if (endpoint.origin !== this.base.origin) throw new Error("Invalid Core endpoint");
    const response = await (this.options.fetchImpl ?? fetch)(endpoint.toString(), {
      method,
      headers: {
        ...(!cookieMode ? { authorization: `Bearer ${token}` } : {}),
        accept: "application/json",
        ...(input !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(input !== undefined ? { body: JSON.stringify(input) } : {}),
      cache: "no-store",
      ...(cookieMode ? {credentials:"same-origin" as const} : {}),
    });
    if (!response.ok) {
      const reason = response.status === 409 ? "conflict"
        : response.status === 401 ? "unauthorized"
        : response.status === 403 ? "forbidden"
        : response.status === 404 ? "not_found" : "rejected";
      throw new BoPublicViewHttpError(response.status, reason);
    }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new BoPublicViewHttpError(502, "invalid_response"); }
    if (!body || typeof body !== "object" || !("data" in body)) {
      throw new BoPublicViewHttpError(502, "invalid_response");
    }
    return (body as { data: unknown }).data;
  }
  private collection(): string {
    return `${this.options.authMode === "team_cookie" ? "/api/bo" : "/v1/team/bo"}/views/${encodeURIComponent(this.options.moduleKey)}`;
  }
  private item(id: string): string {
    if (!UUID.test(id)) throw new Error("Core durable Saved View ID must be a UUID");
    return `${this.collection()}/${encodeURIComponent(id)}`;
  }
  async list(): Promise<BoPublicView[]> {
    const rows = await this.call(this.collection(), "GET");
    if (!Array.isArray(rows) || rows.length > 120) throw new BoPublicViewHttpError(502, "invalid_response");
    const seen = new Set<string>();
    const parsed = rows.map(row => parseRow(row, this.options.moduleKey, this.fields));
    for (const row of parsed) {
      if (seen.has(row.id)) throw new BoPublicViewHttpError(502, "invalid_response");
      seen.add(row.id);
    }
    return parsed.sort((a,b) => a.position-b.position || a.id.localeCompare(b.id));
  }
  async create(write: Extract<BoViewWrite, {kind:"create"}>): Promise<BoPublicView> {
    this.requireManager();
    if (write.moduleKey !== this.options.moduleKey) throw new Error("View module mismatch");
    // Write.id is only a client-local transient key: Core generates durable identity.
    const config = validateBoViewConfig(write.config, this.fields);
    const data = await this.call(this.collection(), "POST", { name: write.name, config });
    return parseRow(data, this.options.moduleKey, this.fields);
  }
  async update(write: BoViewUpdateIntent): Promise<BoPublicView> {
    this.requireManager();
    if (write.moduleKey !== this.options.moduleKey) throw new Error("View module mismatch");
    if (!Number.isSafeInteger(write.expectedVersion) || write.expectedVersion < 1) throw new Error("Invalid version");
    const config = validateBoViewConfig(write.config, this.fields);
    const row = parseRow(await this.call(this.item(write.id), "PATCH",
      { expectedVersion: write.expectedVersion, config }), this.options.moduleKey, this.fields);
    if (row.id !== write.id || row.version <= write.expectedVersion) {
      throw new BoPublicViewHttpError(502, "invalid_response");
    }
    return row;
  }
  async rename(write: Extract<BoViewWrite, {kind:"rename"}>): Promise<BoPublicView> {
    this.requireManager();
    if (write.moduleKey !== this.options.moduleKey) throw new Error("View module mismatch");
    if (!Number.isSafeInteger(write.expectedVersion) || write.expectedVersion < 1) throw new Error("Invalid version");
    const row = parseRow(await this.call(`${this.item(write.id)}/rename`, "PATCH",
      { expectedVersion:write.expectedVersion, name:write.name }), this.options.moduleKey, this.fields);
    if (row.id !== write.id || row.version <= write.expectedVersion) throw new BoPublicViewHttpError(502,"invalid_response");
    return row;
  }
  async remove(write: Extract<BoViewWrite, {kind:"delete"}>): Promise<void> {
    this.requireManager();
    if (write.moduleKey !== this.options.moduleKey) throw new Error("View module mismatch");
    if (!Number.isSafeInteger(write.expectedVersion) || write.expectedVersion < 1) throw new Error("Invalid version");
    const receipt=await this.call(this.item(write.id),"DELETE",{expectedVersion:write.expectedVersion});
    if (!receipt || typeof receipt !== "object" || (receipt as {id?:unknown}).id !== write.id ||
      (receipt as {deleted?:unknown}).deleted !== true) throw new BoPublicViewHttpError(502,"invalid_response");
  }
  async reorder(write: Extract<BoViewWrite, {kind:"reorder"}>): Promise<BoPublicView[]> {
    this.requireManager();
    if (write.moduleKey !== this.options.moduleKey) throw new Error("View module mismatch");
    const positions=write.positions.map(x=>({
      id:this.item(x.id).split("/").pop()!,
      expectedVersion:x.expectedVersion,
      position:x.position,
    }));
    if (!positions.length || new Set(positions.map(x=>x.id)).size !== positions.length ||
      new Set(positions.map(x=>x.position)).size !== positions.length ||
      positions.some(x=>!Number.isSafeInteger(x.expectedVersion) || x.expectedVersion < 1 ||
        !Number.isSafeInteger(x.position) || x.position < 0 || x.position >= positions.length)) {
      throw new Error("Invalid view order");
    }
    const rows=await this.call(`${this.collection()}/reorder`,"PUT",{positions});
    if (!Array.isArray(rows) || rows.length !== positions.length) throw new BoPublicViewHttpError(502,"invalid_response");
    const parsed=rows.map(row=>parseRow(row,this.options.moduleKey,this.fields));
    const expected=new Map(positions.map(p=>[p.id,p.expectedVersion]));
    if (new Set(parsed.map(x=>x.id)).size!==parsed.length || parsed.some(x=>!expected.has(x.id) ||
      x.version <= expected.get(x.id)!)) throw new BoPublicViewHttpError(502,"invalid_response");
    return parsed.sort((a,b)=>a.position-b.position);
  }
}
