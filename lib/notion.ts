import { Client } from "@notionhq/client";
import type { NotionPage } from "@/lib/notion/types";

let client: Client | null = null;
const dataSourceCache = new Map<string, string>();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function notion(): Client {
  client ??= new Client({ auth: requiredEnv("NOTION_TOKEN") });
  return client;
}

/**
 * Environment variables store Notion Database IDs. The Notion API queries
 * database rows through a Data Source ID, so resolve it at runtime.
 */
export async function dataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) return cached;

  const response = await notion().databases.retrieve({ database_id: databaseId });
  const sources = "data_sources" in response ? response.data_sources : undefined;
  const resolved = sources?.[0]?.id;

  if (!resolved) {
    throw new Error(`No data source found for Notion database ${databaseId}`);
  }

  dataSourceCache.set(databaseId, resolved);
  return resolved;
}

export function dbId(name: string): string {
  return requiredEnv(name);
}

export async function queryAll(databaseId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  const sourceId = await dataSourceId(databaseId);
  let startCursor: string | undefined;

  do {
    const response = await notion().dataSources.query({
      data_source_id: sourceId,
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    });

    pages.push(...(response.results as NotionPage[]));
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (startCursor);

  return pages;
}
