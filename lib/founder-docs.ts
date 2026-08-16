import { promises as fs } from "node:fs";
import path from "node:path";

export type FounderDocGroup = "Founder Review" | "Features" | "Architecture" | "ADRs" | "Runbooks";
export type FounderDocumentGroup = Exclude<FounderDocGroup, "Founder Review">;

export type FounderDocument = {
  relativePath: string;
  sourcePath: string;
  title: string;
  group: FounderDocumentGroup;
  specStatus: string;
  implementationStatus: string | null;
  authority: string;
  canonicalRepo: string;
  surfaces: string[];
  relatedAdrs: string[];
  codeModules: string[];
  content: string;
  updatedAt: string;
};

type Frontmatter = Record<string, string>;

const GROUP_ORDER: FounderDocGroup[] = ["Founder Review", "Features", "Architecture", "ADRs", "Runbooks"];
const DOCUMENT_GROUP_ORDER: FounderDocumentGroup[] = ["Features", "Architecture", "ADRs", "Runbooks"];

export async function loadFounderDocuments(): Promise<{ documents: FounderDocument[]; repoRoot: string }> {
  const repoRoot = resolveCoreRepoRoot();
  const docsRoot = path.join(repoRoot, "docs");
  let files: string[];
  try {
    files = await walkMarkdown(docsRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Không thể đọc pino-core docs tại ${docsRoot}. Đặt PINO_CORE_REPO_PATH nếu hai repo không nằm cạnh nhau. ${reason}`);
  }

  const documents = await Promise.all(files
    .filter(file => !["README.md", "TEMPLATE.md"].includes(path.basename(file)))
    .map(async file => {
      const absolute = path.join(docsRoot, file);
      const [raw, stat] = await Promise.all([fs.readFile(absolute, "utf8"), fs.stat(absolute)]);
      return toDocument(file, raw, stat.mtime.toISOString());
    }));

  documents.sort((a, b) => {
    const groupDelta = DOCUMENT_GROUP_ORDER.indexOf(a.group) - DOCUMENT_GROUP_ORDER.indexOf(b.group);
    if (groupDelta) return groupDelta;
    return a.title.localeCompare(b.title, "vi");
  });
  return { documents, repoRoot };
}

export function founderDocGroups(): FounderDocGroup[] { return GROUP_ORDER; }

export function documentsForGroup(documents: FounderDocument[], group: FounderDocGroup): FounderDocument[] {
  if (group === "Founder Review") {
    return documents.filter(doc => doc.group === "Features" && doc.specStatus === "PROPOSED");
  }
  return documents.filter(doc => doc.group === group);
}

function resolveCoreRepoRoot(): string {
  const configured = process.env.PINO_CORE_REPO_PATH?.trim();
  return configured ? path.resolve(configured) : path.resolve(process.cwd(), "..", "pino-core");
}

async function walkMarkdown(root: string, relative = ""): Promise<string[]> {
  const here = path.join(root, relative);
  const entries = await fs.readdir(here, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    const child = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) output.push(...await walkMarkdown(root, child));
    else if (entry.isFile() && entry.name.endsWith(".md")) output.push(child.replaceAll(path.sep, "/"));
  }
  return output;
}

function toDocument(relativePath: string, raw: string, updatedAt: string): FounderDocument {
  const { meta, body } = parseFrontmatter(raw);
  const group = groupFor(relativePath);
  const title = meta.title || firstHeading(body) || humanize(relativePath);
  const inferredAdrStatus = group === "ADRs" && /(?:^|\n)(?:#+\s*)?Status(?::|\s*\n)\s*accepted\.?/i.test(body) ? "APPROVED" : null;
  const inferredFeatureStatus = relativePath.startsWith("features/proposals/") ? "PROPOSED" : null;
  const specStatus = (meta.spec_status || inferredAdrStatus || inferredFeatureStatus || "CURRENT").toUpperCase();
  return {
    relativePath,
    sourcePath: `docs/${relativePath}`,
    title,
    group,
    specStatus,
    implementationStatus: meta.implementation_status?.toUpperCase() || null,
    authority: meta.authority || (group === "ADRs" ? "Accepted architecture decision" : group === "Architecture" ? "Architecture reference" : "Documentation reference"),
    canonicalRepo: meta.canonical_repo || "pino-core",
    surfaces: csv(meta.surfaces),
    relatedAdrs: csv(meta.related_adrs),
    codeModules: csv(meta.code_modules),
    content: body.trim(),
    updatedAt,
  };
}

function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  if (!raw.startsWith("---\n")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return { meta: {}, body: raw };
  const meta: Frontmatter = {};
  for (const line of raw.slice(4, end).split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { meta, body: raw.slice(end + 5) };
}

function groupFor(relativePath: string): FounderDocumentGroup {
  if (relativePath.startsWith("features/")) return "Features";
  if (relativePath.startsWith("adr/")) return "ADRs";
  if (relativePath === "environments.md" || relativePath === "migrations.md") return "Runbooks";
  return "Architecture";
}

function firstHeading(body: string): string | null {
  const match = /^#\s+(.+)$/m.exec(body);
  return match?.[1]?.trim() || null;
}

function humanize(relativePath: string): string {
  return path.basename(relativePath, ".md").replace(/^\d+-?/, "").replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function csv(value?: string): string[] {
  return value ? value.split(",").map(item => item.trim()).filter(Boolean) : [];
}
