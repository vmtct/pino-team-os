import { LocalStaffSessionError } from "./local-staff-session";
import { TeamAuthError } from "./team-auth";

/** PAP-1323: map only known authentication failures; never mask unexpected server faults. */
export function tvLaunchAuthErrorResponse(error: unknown): Response | null {
  if (!(error instanceof LocalStaffSessionError) && !(error instanceof TeamAuthError)) return null;
  const status = error instanceof TeamAuthError ? error.status : 401;
  return Response.json(
    { error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}
