import { runtimeJson, type TvRuntimeCoreBinding } from "@/lib/tv-runtime-core";
import { projectTvRuntimeStatus } from "./status-projection";

/** Preserve opaque display-runtime authority; do not accept caller-provided center IDs. */
export async function handleTvRuntimePresentationStatus(
  token: string, displayId: string,
  core: Pick<TvRuntimeCoreBinding, "presentationStatus">,
): Promise<Response> {
  if (!token) return Response.json(
    { error: { code: "TV_RUNTIME_SESSION_REQUIRED", message: "TV runtime session is required" } },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
  try {
    const result = await core.presentationStatus(token, displayId);
    if (result.status !== 200) return runtimeJson(result);
    try {
      return Response.json(projectTvRuntimeStatus(result.body), {
        status: 200,
        headers: { "cache-control": "no-store", "x-request-id": result.requestId },
      });
    } catch {
      return Response.json(
        { error: { code: "TV_PRESENTATION_STATUS_UNAVAILABLE", message: "TV status unavailable" } },
        { status: 503, headers: { "cache-control": "no-store", "x-request-id": result.requestId } },
      );
    }
  } catch {
    // RPC network/availability failure must never release a TV scene.
    return Response.json(
      { error: { code: "TV_PRESENTATION_STATUS_UNAVAILABLE", message: "TV status unavailable" } },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
