import type { FieldSchema } from "../workspace-schema";
import type { SurfaceOptions } from "./contracts";
import { surfaceSession, type CenterSource } from "./session";
import { bindSurface } from "./adapter";
/** Selected Center is a candidate until revalidated by an existing Core-backed source. */
export async function createBoTddAdapter<F extends readonly FieldSchema[]>(options: SurfaceOptions<F> & { readonly centerId: string; readonly centerSource?: CenterSource }, signal: AbortSignal) {
  const session = surfaceSession("BO", options.origin, options.fetcher, { id: options.centerId, source: options.centerSource ?? "centers" });
  try { return await bindSurface(session, options, signal); } catch (error) { session.dispose(); throw error; }
}
