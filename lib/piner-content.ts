export type PinerContentType = "label" | "text" | "cta" | "rich_text";

export interface PinerContentRelease {
  id: string;
  product: string;
  locale: string;
  releaseNumber: number;
  releaseKey: string;
  publishedAt: string;
  publishedBy: string;
}

export interface PinerContentEntry {
  id: string;
  key: string;
  surface: string;
  section: string;
  type: PinerContentType;
  fallbackValue: string;
  publishedValue: string;
  draftValue: string | null;
  effectiveValue: string;
  hasDraft: boolean;
}

export interface PinerContentRegistry {
  product: "piner";
  locale: string;
  release: PinerContentRelease | null;
  entries: PinerContentEntry[];
  releases: PinerContentRelease[];
}

interface ApiErrorShape { error?: { code?: string; message?: string } }

export class PinerContentApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/founder${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const body = await response.json() as T & ApiErrorShape;
  if (!response.ok) {
    throw new PinerContentApiError(
      response.status,
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? "Không thể hoàn tất yêu cầu.",
    );
  }
  return body;
}

export const pinerContentApi = {
  load: () => request<PinerContentRegistry>("/content/piner"),
  saveDraft: (key: string, value: string) => request<{ key: string; draftValue: string }>("/content/piner", {
    method: "PUT",
    body: JSON.stringify({ key, value }),
  }),
  publish: () => request<{ release: PinerContentRelease }>("/content/piner/publish", {
    method: "POST",
    body: JSON.stringify({}),
  }),
  rollback: (releaseId: string) => request<{ release: PinerContentRelease; rolledBackFrom: PinerContentRelease }>("/content/piner/rollback", {
    method: "POST",
    body: JSON.stringify({ releaseId }),
  }),
};
