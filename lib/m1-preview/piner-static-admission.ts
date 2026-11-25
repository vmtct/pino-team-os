/** PAP-2342 / PLT-M1-DELIVERY — static Piner M1-B decision only.
 * All proofs and registration must come from trusted server-side verification,
 * never from the browser, request query, a synthetic profile, or fixture data.
 * This predicate does not authenticate, grant permissions, mount a provider,
 * fetch media, or enable a Worker. Missing proof is a denial.
 */
const routes = {
  "/piner/house": "house",
  "/piner/house/grid": "house",
  "/piner/mytime": "mytime",
  "/piner/mytime/grid": "mytime",
} as const;
type Route = keyof typeof routes;
type Program = (typeof routes)[Route];
type Artifact = {
  route: string;
  fixtureId: string;
  photoCount: number;
  sourceRevision: string;
  sha256: string;
};
export type PinerStaticAdmission = {
  environment?: string;
  featureEnabled: boolean;
  requestUrl: string;
  method: string;
  registration?: Artifact;
  verifiedArtifact?: Artifact;
  approvedSourceRevision?: string;
  proof?: {
    authenticated: boolean;
    surfaceAuthorized: boolean;
    featureReviewAuthorized: boolean;
    scopeAuthorized: boolean;
    program: Program;
  };
};
type Denial = "disabled" | "not_registered" | "method" | "unauthenticated" |
  "forbidden" | "artifact_mismatch" | "invalid_state";
type Decision = { allowed: false; reason: Denial } |
  { allowed: true; route: Route; program: Program; photo: number };
const deny = (reason: Denial): Decision => ({ allowed: false, reason });
const sha = /^[a-f0-9]{64}$/;
const revision = /^[a-f0-9]{40}$/;
export function decidePinerStaticM1(input: PinerStaticAdmission): Decision {
  if (typeof window !== "undefined") throw new Error("M1 admission must run on the server");
  if (input.environment !== "staging" || input.featureEnabled !== true) return deny("disabled");
  let url: URL;
  try { url = new URL(input.requestUrl); } catch { return deny("disabled"); }
  if (url.origin !== "https://app.staging.pinohouse.art" || url.username || url.password || url.hash) return deny("disabled");
  if (!Object.hasOwn(routes, url.pathname)) return deny("not_registered");
  const route = url.pathname as Route;
  const program = routes[route];
  if (input.method !== "GET" && input.method !== "HEAD") return deny("method");
  if (input.proof?.authenticated !== true) return deny("unauthenticated");
  if (input.proof.surfaceAuthorized !== true || input.proof.featureReviewAuthorized !== true ||
      input.proof.scopeAuthorized !== true || input.proof.program !== program) return deny("forbidden");
  const r = input.registration, a = input.verifiedArtifact;
  if (!r || !a || r.route !== route || r.fixtureId !== "PORTFOLIO-MOCK-001" ||
      !Number.isInteger(r.photoCount) || r.photoCount < 1 || r.photoCount > 5 ||
      !revision.test(r.sourceRevision) || r.sourceRevision !== input.approvedSourceRevision ||
      !sha.test(r.sha256) || a.route !== r.route || a.fixtureId !== r.fixtureId ||
      a.photoCount !== r.photoCount || a.sourceRevision !== r.sourceRevision || a.sha256 !== r.sha256) {
    return deny("artifact_mismatch");
  }
  if (!url.search) return { allowed: true, route, program, photo: 1 };
  const q = url.searchParams;
  if (q.size !== 2 || q.getAll("post").length !== 1 || q.getAll("photo").length !== 1 ||
      q.get("post") !== r.fixtureId || !/^[1-5]$/.test(q.get("photo") ?? "") ||
      Number(q.get("photo")) > r.photoCount) return deny("invalid_state");
  return { allowed: true, route, program, photo: Number(q.get("photo")) };
}
