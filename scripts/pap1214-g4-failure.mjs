/** PAP-1214: safe CI failure telemetry; no untrusted URL, exception message, screenshot or PII. */
const allowedPhases = new Set(["unspecified", "navigate", "runtime_surface_visible", "invalid_detail_absent"]);
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
