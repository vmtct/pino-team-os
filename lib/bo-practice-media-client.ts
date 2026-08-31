import { BoApiError } from "./bo-api-error";
import type { BoPracticeMediaUpload } from "./bo-practice-model";

export async function uploadPracticeMedia(file: File, pathProgramId: string, idempotencyKey: string): Promise<BoPracticeMediaUpload> {
  const form = new FormData();
  form.set("file", file);
  form.set("pathProgramId", pathProgramId);
  const response = await fetch("/api/bo/practice/media", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: form,
  });
  const text = await response.text();
  let payload: { data?: BoPracticeMediaUpload; error?: { message?: string; requestId?: string } };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new BoApiError(
      response.status,
      text.trim() || "Practice media upload returned an invalid response.",
      response.headers.get("x-request-id"),
    );
  }
  if (!response.ok || payload.data === undefined) {
    throw new BoApiError(
      response.status,
      payload.error?.message ?? "Practice media could not be uploaded.",
      response.headers.get("x-request-id") ?? payload.error?.requestId ?? null,
    );
  }
  return payload.data;
}
