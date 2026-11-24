/** PAP-2345 / PLT-M1-DELIVERY. Offline registration evidence only; never publishes or authorizes a preview. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const sha = /^[a-f0-9]{40}$/;
const sourcePath = /^(?:app|lib|packages)\/[A-Za-z0-9_./()-]+\.(?:tsx?|jsx?|css)$/;
const safeRelative = p => typeof p === "string" && !p.includes("\\") && !isAbsolute(p) &&
  p.split("/").every(part => part && part !== "." && part !== ".." && /^[A-Za-z0-9_.()-]+$/.test(part));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export function createRegistration(spec, revision, readSource, assets) {
  if (!sha.test(revision) || spec.sourceRevision !== revision) throw new Error("Source revision mismatch");
  if (!/^PAP-[1-9][0-9]*$/.test(spec.jiraTask ?? "") || !/^[A-Z][A-Z0-9-]+$/.test(spec.epicCode ?? "")) throw new Error("Invalid ownership");
  if (!["bo","ho"].includes(spec.surface) || !/^[A-Z][A-Z0-9-]*-MOCK-001$/.test(spec.fixtureId ?? "")) throw new Error("Invalid surface/fixture");
  const url = new URL(spec.reviewUrl);
  if (url.origin !== "http://192.168.1.6:8800" || url.username || url.password || url.hash ||
      !(url.pathname === "/" + spec.surface || url.pathname.startsWith("/" + spec.surface + "/"))) throw new Error("Noncanonical review route");
  const sourceFiles = {};
  for (const role of ["route","renderer","schema","fixture"]) {
    const path = spec.sourceFiles?.[role];
    if (!safeRelative(path) || !sourcePath.test(path)) throw new Error("Invalid source path: " + role);
    const bytes = readSource(path);
    if (!bytes.length) throw new Error("Empty source file: " + role);
    sourceFiles[role] = {path, sha256:hash(bytes)};
  }
  const files = [...assets].map(({path, bytes}) => {
    if (!safeRelative(path) || !Buffer.isBuffer(bytes) || !bytes.length) throw new Error("Invalid asset");
    return {path, size:bytes.length, sha256:hash(bytes)};
  }).sort((a,b)=> a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!files.length || new Set(files.map(x=>x.path.toLowerCase())).size !== files.length) throw new Error("Empty or ambiguous artifact");
  return {
    schemaVersion:1, kind:"M1_OFFLINE_PREVIEW_REGISTRATION", jiraTask:spec.jiraTask, epicCode:spec.epicCode,
    surface:spec.surface, reviewUrl:url.href, sourceRevision:revision, fixtureId:spec.fixtureId,
    sourceFiles, artifact:{files, sha256:hash(JSON.stringify(files))},
    servingVerified:false, admissionVerified:false, founderGate:"PENDING_MANUAL"
  };
}

export function readAssets(directory) {
  const root = realpathSync(directory);
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error("Artifact directory required");
  const files = [];
  function visit(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir,name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error("Symbolic link not allowed");
      const rel = relative(root,realpathSync(path));
      if (rel === ".." || rel.startsWith(".." + (process.platform==="win32"?"\\":"/")) || isAbsolute(rel)) throw new Error("Asset escapes root");
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.push({path:rel.split("\\").join("/"),bytes:readFileSync(path)});
      else throw new Error("Unsupported artifact entry");
    }
  }
  visit(root);
  return files;
}

export function registrationFromDisk(repo, spec, directory) {
  const git = (...args) => execFileSync("git",["-C",repo,...args]);
  const revision = git("rev-parse","HEAD").toString("utf8").trim();
  if (git("status","--porcelain").toString("utf8").trim()) throw new Error("Dirty source worktree");
  return createRegistration(spec,revision,path=>git("show",revision+":"+path),readAssets(directory));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 5) throw new Error("Usage: node scripts/m1-preview-provenance.mjs <source-worktree> <registration-spec.json> <artifact-dir>");
    console.log(JSON.stringify(registrationFromDisk(process.argv[2],JSON.parse(readFileSync(process.argv[3],"utf8")),process.argv[4]),null,2));
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
