import { Client } from "@notionhq/client";
import type { NotionPage } from "@/lib/notion/types";

let client: Client | null = null;
const dataSourceCache = new Map<string, string>();
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
function logNotionError(operation: string, error: unknown) { const value = error && typeof error === "object" ? error as Record<string, unknown> : {}; console.error("[Notion] request failed", { operation, name: error instanceof Error ? error.name : undefined, message: error instanceof Error ? error.message : value.message, status: value.status, code: value.code, requestId: value.request_id }); }
export function notion(): Client { client ??= new Client({ auth: requiredEnv("NOTION_TOKEN") }); return client; }

export async function dataSourceId(databaseIdOrDataSourceId: string): Promise<string> {
  const cached = dataSourceCache.get(databaseIdOrDataSourceId);
  if (cached) return cached;
  try {
    const response = await notion().databases.retrieve({ database_id: databaseIdOrDataSourceId });
    const sources = "data_sources" in response ? response.data_sources : undefined;
    const resolved = sources?.[0]?.id;
    if (!resolved) throw new Error("No data source found for Notion database");
    dataSourceCache.set(databaseIdOrDataSourceId, resolved);
    return resolved;
  } catch (databaseError) {
    try {
      await notion().dataSources.retrieve({ data_source_id: databaseIdOrDataSourceId });
      console.warn("[Notion] using configured data source id directly", { id: databaseIdOrDataSourceId });
      dataSourceCache.set(databaseIdOrDataSourceId, databaseIdOrDataSourceId);
      return databaseIdOrDataSourceId;
    } catch (dataSourceError) {
      logNotionError("databases.retrieve", databaseError);
      logNotionError("dataSources.retrieve", dataSourceError);
      throw databaseError;
    }
  }
}

export function dbId(name: string): string { return requiredEnv(name); }
export async function queryAll(databaseId: string): Promise<NotionPage[]> { const pages: NotionPage[] = []; const sourceId = await dataSourceId(databaseId); let startCursor: string | undefined; do { try { const response = await notion().dataSources.query({ data_source_id: sourceId, page_size: 100, ...(startCursor ? { start_cursor: startCursor } : {}) }); pages.push(...(response.results as NotionPage[])); startCursor = response.has_more ? response.next_cursor ?? undefined : undefined; } catch (error) { logNotionError("dataSources.query", error); throw error; } } while (startCursor); return pages; }
export async function getPage(pageId: string): Promise<NotionPage> { try { return await notion().pages.retrieve({ page_id: pageId }) as unknown as NotionPage; } catch (error) { logNotionError("pages.retrieve", error); throw error; } }

export async function updatePageProperties(pageId: string, properties: Record<string, unknown>): Promise<NotionPage> {
  try {
    return await notion().pages.update({ page_id: pageId, properties: properties as any }) as unknown as NotionPage;
  } catch (error) {
    logNotionError("pages.update", error);
    throw error;
  }
}

const NOTION_API_VERSION = "2026-03-11";
const MAX_NOTION_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function uploadNotionFile(file: File, filename: string): Promise<string> {
  if (file.size > MAX_NOTION_UPLOAD_BYTES) throw new Error("File vượt quá giới hạn 20MB");
  const token = requiredEnv("NOTION_TOKEN");
  const createResponse = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": NOTION_API_VERSION },
    body: JSON.stringify({ mode: "single_part", filename, content_type: file.type }),
  });
  if (!createResponse.ok) throw new Error(`Notion file upload create failed (${createResponse.status})`);
  const created = await createResponse.json() as { id: string; upload_url?: string };
  if (!created.id || !created.upload_url) throw new Error("Notion did not return an upload URL");

  const form = new FormData();
  form.append("file", file, filename);
  const sendResponse = await fetch(created.upload_url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_API_VERSION },
    body: form,
  });
  if (!sendResponse.ok) throw new Error(`Notion file upload send failed (${sendResponse.status})`);
  return created.id;
}

export async function appendFileUploadsToPage(pageId: string, propertyName: string, uploads: Array<{ id: string; name: string }>): Promise<NotionPage> {
  const page = await getPage(pageId);
  const current = page.properties[propertyName] as { files?: unknown[] } | undefined;
  const existing = Array.isArray(current?.files) ? current.files : [];
  const files = [
    ...existing,
    ...uploads.map((upload) => ({ type: "file_upload", file_upload: { id: upload.id }, name: upload.name })),
  ];
  return updatePageProperties(pageId, { [propertyName]: { files } });
}
