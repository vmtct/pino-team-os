/** PAP-1214: safe CI failure telemetry; never echo URLs, exception messages or PII. */
// PAP-1214 + PAP-1340 + PAP-1394: finite, non-sensitive phase vocabulary only.
const allowedPhases = new Set([
  "unspecified", "navigate", "runtime_surface_visible", "invalid_detail_absent", "invalid_error_visible",
  // PAP-1340: Students -> real Subscription detail.
  "student_center_context",
  "student_table",
  "subscribed_student_lookup",
  "student_search_and_drawer",
  "student_full_detail",
  "subscription_tab",
  "subscription_row",
  "subscription_drawer_full_detail",
  "subscription_route",
  "subscription_detail_subtitle",
  // PAP-1394: HO Staff Table -> Drawer -> Detail.
  "ho_staff_navigate",
  "ho_staff_table",
  "ho_staff_row",
  "ho_staff_drawer",
  "ho_staff_full_detail",
  "ho_staff_tab_overview",
  "ho_staff_tab_salary",
  "ho_staff_tab_history",
  "ho_staff_width_1440",
  "ho_staff_width_1024",
  "ho_staff_width_768",
  "ho_staff_width_390",
  "ho_staff_width_320",
  "ho_staff_back",
]);
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
  const allowed = ["subscriptionHost", "subscriptionSurface", "invalidAlert", "anyDetail", "redirectedLogin", "nextError", "invalidRecordParam", "subscriptionModuleParam", "anyAlert", "invalidCopyPresent"];
  return Object.fromEntries(allowed.map(key => [key, flags?.[key] === true]));
}


/** PAP-1398: no response bodies, identifiers, URLs or exception details in CI logs. */
export function safeG4HoStaffProbe(flags = {}) {
  const booleans = ["expectedHost", "staffRoute", "loginRoute",
    "tablePresent", "alertPresent", "statusPresent"];
  const output = Object.fromEntries(booleans.map(key => [key, flags?.[key] === true]));
  for (const key of ["contextHTTP", "staffHTTP"]) {
    const value = flags?.[key];
    output[key] = Number.isInteger(value) && value >= 100 && value <= 599 ? value : 0;
  }
  return output;
}
