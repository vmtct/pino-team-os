import { Client } from "@notionhq/client";
import type { NotionPage } from "@/lib/notion/types";

let client: Client | null = null;
const dataSourceCache = new Map<string, string>();
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
function logNotionError(operation: string, error: unknown) { const value = error && typeof error === "object" ? error as Record<string, unknown> : {}; console.error("[Notion] request failed", { operation, name: error instanceof Error ? error.name : undefined, message: error instanceof Error ? error.message : value.message, status: value.status, code: value.code, requestId: value.request_id }); }
export function notion(): Client { client ??= new Client({ auth: requiredEnv("NOTION_TOKEN") }); return client; }
export async function dataSourceId(databaseId: string): Promise<string> { const cached = dataSourceCache.get(databaseId); if (cached) return cached; try { const response = await notion().databases.retrieve({ database_id: databaseId }); const sources = "data_sources" in response ? response.data_sources : undefined; const resolved = sources?.[0]?.id; if (!resolved) throw new Error("No data source found for Notion database"); dataSourceCache.set(databaseId, resolved); return resolved; } catch (error) { logNotionError("databases.retrieve", error); throw error; } }
export function dbId(name: string): string { return requiredEnv(name); }
export async function queryAll(databaseId: string): Promise<NotionPage[]> { const pages: NotionPage[] = []; const sourceId = await dataSourceId(databaseId); let startCursor: string | undefined; do { try { const response = await notion().dataSources.query({ data_source_id: sourceId, page_size: 100, ...(startCursor ? { start_cursor: startCursor } : {}) }); pages.push(...(response.results as NotionPage[])); startCursor = response.has_more ? response.next_cursor ?? undefined : undefined; } catch (error) { logNotionError("dataSources.query", error); throw error; } } while (startCursor); return pages; }
export async function getPage(pageId: string): Promise<NotionPage> { try { return await notion().pages.retrieve({ page_id: pageId }) as unknown as NotionPage; } catch (error) { logNotionError("pages.retrieve", error); throw error; } }
