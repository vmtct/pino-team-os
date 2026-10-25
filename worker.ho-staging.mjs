// Staging-only adapter. Keep generated OpenNext exports and runtime behavior intact.
import application from "./.open-next/worker.js";
import { handleHoStagingRequest } from "./lib/ho-worker-routing.ts";
export * from "./.open-next/worker.js";
export default { ...application, fetch(request, env, ctx) { return handleHoStagingRequest(request, env, () => application.fetch(request, env, ctx)); } };
