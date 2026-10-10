import { callBoAccessCoreWithCredential, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoSyllabusMediaEnv extends TeamAccessEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}

const MEDIA_PATH = "learning/syllabi/media";
const PREVIEW_PATH = /^learning\/syllabi\/media\/([0-9a-f-]{36})\/preview$/;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const CANONICAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
class SyllabusMediaInputError extends Error {}

type PreviewPayload = { data?: { mediaAssetId: string; mimeType: string; byteSize: number | null; createdAt: string; bytes: ArrayBuffer | ArrayBufferView }; error?: unknown };

export function isBoSyllabusMediaSpecialPath(path: string): boolean {
  return path === MEDIA_PATH || PREVIEW_PATH.test(path);
}

export async function handleBoSyllabusMediaRequest(request: Request, env: BoSyllabusMediaEnv, path: string, keyResolver?: Parameters<typeof teamCredential>[3]): Promise<Response> {
  try {
    const credential = await teamCredential(request, env, "BO", keyResolver);
    if (path === MEDIA_PATH) {
      if (request.method === "GET") {
        const pathProgramId = pathContext(new URL(request.url).searchParams.get("pathProgramId"));
        const corePath = pathProgramId ? `${MEDIA_PATH}?pathProgramId=${encodeURIComponent(pathProgramId)}` : MEDIA_PATH;
        const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, { method: "GET", path: corePath }, credential);
        return json(result.body, result.status, { "x-request-id": result.requestId });
      }
      if (request.method !== "POST") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
      const idempotencyKey = request.headers.get("idempotency-key")?.trim();
      if (!idempotencyKey) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Idempotency-Key is required" } }, 400);
      let form: FormData;
      try { form = await request.formData(); }
      catch { return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A multipart form body is required" } }, 400); }
      const file = form.get("file"), pathProgramId = pathContext(form.get("pathProgramId"));
      if (!(file instanceof File) || file.size < 1) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A non-empty worksheet file is required" } }, 400);
      if (!ALLOWED_MIME_TYPES.has(file.type)) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Worksheet media must be PDF, PNG, JPEG, or WebP" } }, 400);
      const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, {
        method: "POST",
        path: MEDIA_PATH,
        body: { fileName: file.name, mimeType: file.type, bytes: await file.arrayBuffer(), ...(pathProgramId ? { pathProgramId } : {}) },
        idempotencyKey,
      }, credential);
      return json(result.body, result.status, { "x-request-id": result.requestId });
    }

    if (!PREVIEW_PATH.test(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    const pathProgramId = pathContext(new URL(request.url).searchParams.get("pathProgramId"));
    const corePath = pathProgramId ? `${path}?pathProgramId=${encodeURIComponent(pathProgramId)}` : path;
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, { method: "GET", path: corePath }, credential);
    if (result.status < 200 || result.status >= 300) return json(result.body, result.status, { "x-request-id": result.requestId });
    const payload = result.body as PreviewPayload;
    const data = payload?.data;
    if (!data || !ALLOWED_MIME_TYPES.has(data.mimeType)) return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Core returned an invalid worksheet preview" } }, 502, { "x-request-id": result.requestId });
    const bytes = toArrayBuffer(data.bytes);
    if (!bytes) return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Core returned invalid worksheet bytes" } }, 502, { "x-request-id": result.requestId });
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": data.mimeType,
        "content-length": String(bytes.byteLength),
        "content-disposition": "inline",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": result.requestId,
      },
    });
  } catch (error) {
    if (error instanceof SyllabusMediaInputError) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: error.message } }, 400);
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    console.error("BO Syllabus media facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

function pathContext(value: FormDataEntryValue | string | null): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new SyllabusMediaInputError("Invalid Path context");
  const normalized = value.trim();
  if (!CANONICAL_ID.test(normalized)) throw new SyllabusMediaInputError("Invalid Path context");
  return normalized;
}

function toArrayBuffer(value: ArrayBuffer | ArrayBufferView): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  return null;
}
function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
