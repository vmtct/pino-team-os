import { Client } from "@notionhq/client";
import type { NotionPage } from "@/lib/notion/types";

let client: Client | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function notion(): Client {
  client ??= new Client({ auth: requiredEnv("NOTION_TOKEN") });
  return client;
}

export function dbId(name: string): string {
  return requiredEnv(name);
}

export async function queryAll(dataSourceId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion().dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    });

    pages.push(...(response.results as NotionPage[]));
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (startCursor);

  return pages;
}
