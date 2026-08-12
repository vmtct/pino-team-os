import { dbId, queryAll } from "@/lib/notion";
import { checkboxProp, selectProp, textProp } from "@/lib/notion/properties";
import type { NotionPage } from "@/lib/notion/types";

const FALLBACK_CONFIG_DB = "621e10ac3fcf43958d8ca31c78c4cfec";

type WebConfig = { key: string; value: string; active: boolean; environment: string; group: string; type: string; description: string };

function configDbId(): string {
  return process.env.NOTION_WEB_CONFIG_DB_ID || FALLBACK_CONFIG_DB;
}

function mapConfig(page: NotionPage): WebConfig {
  return {
    key: textProp(page, "Key"),
    value: textProp(page, "Value"),
    active: checkboxProp(page, "Active"),
    environment: selectProp(page, "Environment"),
    group: selectProp(page, "Group"),
    type: selectProp(page, "Type"),
    description: textProp(page, "Description"),
  };
}

export async function getWebConfig(): Promise<Map<string, string>> {
  const pages = await queryAll(configDbId());
  const map = new Map<string, string>();
  for (const item of pages.map(mapConfig)) {
    if (!item.active || item.environment !== "Production" || !item.key) continue;
    map.set(item.key, item.value);
  }
  return map;
}

export async function getConfigValue(key: string, fallback = ""): Promise<string> {
  const config = await getWebConfig();
  return config.get(key) ?? fallback;
}

export async function getConfigBoolean(key: string, fallback = false): Promise<boolean> {
  const value = (await getConfigValue(key, fallback ? "true" : "false")).trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
