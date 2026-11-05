import type { FieldSchema } from "../workspace-schema";
import type { SurfaceOptions } from "./contracts";
import { surfaceSession } from "./session";
import { bindSurface } from "./adapter";
/** Existing staging host + server Founder gate; never converts BO grants into HO access. */
export async function createHoTddAdapter<F extends readonly FieldSchema[]>(options: SurfaceOptions<F>, signal: AbortSignal) {
  const session = surfaceSession("HO", options.origin, options.fetcher);
  try { return await bindSurface(session, options, signal); } catch (error) { session.dispose(); throw error; }
}
