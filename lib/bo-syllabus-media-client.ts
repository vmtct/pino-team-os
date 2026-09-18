import { BoApiError } from "./bo-api-error";
import type { BoSyllabusWorksheetMedia } from "./bo-model";

export async function uploadSyllabusWorksheetMedia(file: File, idempotencyKey: string): Promise<BoSyllabusWorksheetMedia> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/bo/learning/syllabi/media", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: form,
  });
  const text = await response.text();
  let payload: { data?: BoSyllabusWorksheetMedia; error?: { message?: string; requestId?: string } };
  try { payload = JSON.parse(text) as typeof payload; }
  catch { throw new BoApiError(response.status, text.trim() || "Worksheet upload returned an invalid response.", response.headers.get("x-request-id")); }
  if (!response.ok || payload.data === undefined) throw new BoApiError(response.status, payload.error?.message ?? "Worksheet could not be uploaded.", response.headers.get("x-request-id") ?? payload.error?.requestId ?? null);
  return payload.data;
}

export function syllabusWorksheetPreviewUrl(mediaAssetId: string): string {
  return `/api/bo/learning/syllabi/media/${encodeURIComponent(mediaAssetId)}/preview`;
}
