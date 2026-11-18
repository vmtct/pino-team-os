// PAP-1887 — Afterschool Secure PIN Session (Epic PAP-1832 PNR-IDENTITY).
// Staging Piner Worker public routing; the BFF adapter alone controls auth.
// The BFF admits the minimal student list only for a live full PIN session.
import { handlePinerAfterschoolPinAuth } from "./piner-afterschool-pin-bff.mjs";

export async function dispatchPinerAfterschoolPin(request, env) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/api/piner/afterschool/")) return null;
  return handlePinerAfterschoolPinAuth(request, env);
}
