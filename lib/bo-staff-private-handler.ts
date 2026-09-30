import { callBoAccessCoreWithCredential, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoStaffPrivateEnv extends TeamAccessEnv { PINO_BO_CORE: BoAccessCoreBinding; }
const DOCUMENT_PATH = /^workforce\/staff-records\/([0-9a-f-]{36})\/private\/documents\/([0-9a-f-]{36})$/;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isBoStaffPrivateDocumentPath(path: string): boolean { return DOCUMENT_PATH.test(path); }

export async function handleBoStaffPrivateDocumentRequest(request: Request, env: BoStaffPrivateEnv, path: string): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!DOCUMENT_PATH.test(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);
    const credential = await teamCredential(request, env, "BO");
    const centerId = new URL(request.url).searchParams.get("centerId")?.trim();
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, { method: "GET", path, ...(centerId ? { body: { centerId } } : {}) }, credential);
    if (result.status < 200 || result.status >= 300) return json(result.body, result.status, { "x-request-id": result.requestId });
    const data = (result.body as { data?: { mimeType?: unknown; byteSize?: unknown; bytes?: unknown } })?.data;
    if (!data || typeof data.mimeType !== "string" || !ALLOWED_MIME_TYPES.has(data.mimeType)) return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Core returned an invalid private Staff document" } }, 502, { "x-request-id": result.requestId });
    const bytes = toArrayBuffer(data.bytes);
    if (!bytes || (typeof data.byteSize === "number" && data.byteSize !== bytes.byteLength)) return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Core returned invalid private Staff document bytes" } }, 502, { "x-request-id": result.requestId });
    return new Response(bytes, { status: 200, headers: { "content-type": data.mimeType, "content-length": String(bytes.byteLength), "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-request-id": result.requestId } });
  } catch (error) {
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    console.error("BO Staff private document facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}
function toArrayBuffer(value: unknown): ArrayBuffer | null { if (value instanceof ArrayBuffer) return value; if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer; return null; }
function json(body: unknown, status: number, headers: HeadersInit = {}): Response { return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } }); }
