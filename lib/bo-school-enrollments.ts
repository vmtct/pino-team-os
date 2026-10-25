import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { boSkeletonEnabled } from "./bo-skeleton";
import type { BoSubscriptionDirectoryPage, BoLearnerLifecycle } from "./bo-model";

type Env = BoReadEnv & { APP_ENV?: string; BO_UI_ONLY?: string };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
class Denied { constructor(readonly response: Response) {} }

// An application projection over existing canonical, independently authorized
// reads. Never fetch a global audit/store, and never return guardians/private
// lifecycle fields to the table. The subscription page defines the visible IDs.
export async function handleBoSchoolEnrollments(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!boSkeletonEnabled(env, url.hostname)) return json({ error: { code: "NOT_FOUND" } }, 404);
  if (request.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  const allowed = ["limit", "beforeCreatedAt", "beforeSubscriptionId"];
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return json({ error: { code: "INVALID_QUERY" } }, 400);
  const limit = url.searchParams.get("limit") || "100";
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) return json({ error: { code: "INVALID_QUERY" } }, 400);
  url.searchParams.set("limit", limit);
  const read = async <T>(path: string, query = ""): Promise<T> => {
    const target = new URL("/api/bo/" + path + query, url.origin);
    const result = await handleBoOperationalReadRequest(new Request(target, { headers: request.headers }), env, path);
    if (result.status !== 200) throw new Denied(result);
    return (await result.json() as { data: T }).data;
  };
  try {
    // This read enforces membership.subscription.view and canonical scope.
    const page = await read<BoSubscriptionDirectoryPage>("subscriptions", "?" + url.searchParams);
    if (!page || !Array.isArray(page.items) || page.items.length > Number(limit) || !Object.hasOwn(page, "nextCursor")) throw Error("Invalid subscription page");
    const visible = new Map(page.items.map(s => {
      if (!uuid(s.id) || !uuid(s.studentProfileId) || typeof s.studentDisplayName !== "string" || typeof s.pathDisplayName !== "string") throw Error("Invalid subscription identity");
      return [s.id, s] as const;
    }));
    if (visible.size !== page.items.length) throw Error("Duplicate subscription identity");
    const students = [...new Set(page.items.map(s => s.studentProfileId))];
    const lifecycles = new Map<string, BoLearnerLifecycle>();let index = 0;
    await Promise.all(Array.from({ length: Math.min(4, students.length) }, async () => {
      while (index < students.length) {
        const studentId = students[index++];
        // Each read additionally enforces canonical student ACL/center scope.
        const value = await read<BoLearnerLifecycle>(`students/${studentId}/lifecycle`);
        if (value?.student?.id !== studentId || !Array.isArray(value.subscriptions)) throw Error("Invalid lifecycle identity");
        lifecycles.set(studentId, value);
      }
    }));
    const items = [], seen = new Set<string>();
    for (const [studentId, lifecycle] of lifecycles) for (const group of lifecycle.subscriptions) {
      const subscription = visible.get(group.subscription.id);
      if (!subscription || subscription.studentProfileId !== studentId) continue;
      if (!Array.isArray(group.enrollments)) throw Error("Invalid enrollment list");
      for (const enrollment of group.enrollments) {
        if (!uuid(enrollment.id) || !uuid(enrollment.runningClassId) || enrollment.subscriptionId !== subscription.id || typeof enrollment.runningClassName !== "string" || seen.has(enrollment.id)) throw Error("Invalid enrollment binding");
        seen.add(enrollment.id);
        items.push({ id: enrollment.id, subscriptionId: subscription.id, studentProfileId: studentId, studentDisplayName: subscription.studentDisplayName, pathDisplayName: subscription.pathDisplayName,
          runningClassId: enrollment.runningClassId, runningClassName: enrollment.runningClassName, effectiveFromLocalDate: enrollment.effectiveFromLocalDate,
          effectiveUntilExclusiveLocalDate: enrollment.effectiveUntilExclusiveLocalDate, plannedEntryLocalTime: enrollment.plannedEntryLocalTime, plannedDurationMinutes: enrollment.plannedDurationMinutes });
      }
    }
    return json({ data: { items, limit: page.limit, nextCursor: page.nextCursor } });
  } catch (error) {
    if (error instanceof Denied) return error.response;
    return json({ error: { code: "SCHOOL_DIRECTORY_UNAVAILABLE", message: "Cannot verify enrollment directory" } }, 503);
  }
}
