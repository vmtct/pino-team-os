/** PAP-1214: safe CI failure telemetry; never echo URLs, exception messages or PII. */
const allowedPhases = new Set(["unspecified", "navigate", "runtime_surface_visible", "invalid_detail_absent", "invalid_error_visible"]);
export function safeG4Failure(name, error, phase = "unspecified") {
  const errName = error instanceof Error ? error.name : "";
  const errorType = errName === "TimeoutError" ? "TimeoutError"
    : errName === "AssertionError" ? "AssertionError"
    : errName === "Error" ? "Error"
    : "UnknownError";
  return {
    name,
    status: "FAIL",
    phase: allowedPhases.has(phase) ? phase : "unspecified",
    errorType,
  };
}
/** Whitelist booleans only. Never copy raw page state, text, URLs or stack traces. */
export function safeG4SurfaceProbe(flags) {
  const allowed = ["subscriptionHost", "subscriptionSurface", "invalidAlert", "anyDetail", "redirectedLogin", "nextError"];
  return Object.fromEntries(allowed.map(key => [key, flags?.[key] === true]));
}
