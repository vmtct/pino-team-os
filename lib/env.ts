const coreKeys = ["NOTION_TOKEN", "NOTION_STAFF_DB_ID"] as const;

type CoreEnv = Record<(typeof coreKeys)[number], string>;

export function env(): CoreEnv {
  const missing = coreKeys.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

  return Object.fromEntries(coreKeys.map((key) => [key, process.env[key]!])) as CoreEnv;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
