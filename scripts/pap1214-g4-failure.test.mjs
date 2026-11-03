import test from "node:test";
import assert from "node:assert/strict";
import { safeG4Failure, safeG4SurfaceProbe } from "./pap1214-g4-failure.mjs";

test("PAP-1214 records bounded phase and type but never exception messages, URLs, secrets or PII", () => {
  const error = Object.assign(new Error("PRIVATE_EMAIL cookie=secret https://private.invalid/path?token=secret"), { name: "TimeoutError" });
  const result = safeG4Failure("invalid_id_never_displays_detail", error, "runtime_surface_visible");
  assert.deepEqual(result, {
    name: "invalid_id_never_displays_detail",
    status: "FAIL",
    phase: "runtime_surface_visible",
    errorType: "TimeoutError",
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_EMAIL|secret|private.invalid/);
});

test("PAP-1214 never mirrors arbitrary error class or free-text phases", () => {
  const custom = Object.assign(new Error("secret"), { name: "SensitiveCustomerPayload" });
  assert.deepEqual(safeG4Failure("invalid_id_never_displays_detail", custom, "Bearer abc123"), {
    name: "invalid_id_never_displays_detail",
    status: "FAIL",
    phase: "unspecified",
    errorType: "UnknownError",
  });
  assert.equal(safeG4Failure("case", new Error("no detail"), "invalid_detail_absent").errorType, "Error");
});

test("PAP-1214 surface probe never echoes arbitrary page values", () => {
  const hostile = {
    subscriptionHost: true,
    subscriptionSurface: false,
    invalidAlert: true,
    anyDetail: true,
    redirectedLogin: false,
    nextError: false,
    invalidRecordParam: true,
    subscriptionModuleParam: true,
    anyAlert: true,
    invalidCopyPresent: true,
    cookie: "secret",
    url: "https://example.invalid/private",
    email: "PRIVATE_EMAIL",
  };
  const result = safeG4SurfaceProbe(hostile);
  assert.deepEqual(result, {
    subscriptionHost: true,
    subscriptionSurface: false,
    invalidAlert: true,
    anyDetail: true,
    redirectedLogin: false,
    nextError: false,
    invalidRecordParam: true,
    subscriptionModuleParam: true,
    anyAlert: true,
    invalidCopyPresent: true,
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_EMAIL|secret|private/);
  assert.equal(safeG4SurfaceProbe({subscriptionHost:"true",anyDetail:1}).subscriptionHost, false);
  assert.equal(safeG4Failure("invalid_id_never_displays_detail",new Error("secret"),"invalid_error_visible").phase, "invalid_error_visible");
});

test("PAP-1214 fail-closed G4 source keeps real TDD detail selector and invalid-alert contract", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./run-tdd-g4-ci.mjs",import.meta.url),"utf8");
  assert.match(source, /await fp\.locator\('\[data-bo-runtime-surface="subscriptions-core"\]'\)\.waitFor/);
  assert.match(source, /\[data-tdd-shell="detail"\],\[data-bo-full-detail\]/);
  assert.match(source, /"invalid detail mounted"/);
  assert.match(source, /invalid_error_visible/);
  assert.match(source, /\[data-bo-runtime-surface="subscriptions-core"\] \[role="alert"\]/);
});


test("PAP-1340/PAP-1394 retain only safe Student and HO Staff G4 timeout phases", () => {
  const studentPhases = [
    "student_table", "subscribed_student_lookup", "student_search_and_drawer",
    "student_full_detail", "subscription_tab", "subscription_row",
    "subscription_drawer_full_detail", "subscription_route", "subscription_detail_subtitle",
  ];
  const staffPhases = [
    "ho_staff_navigate", "ho_staff_table", "ho_staff_row", "ho_staff_drawer",
    "ho_staff_full_detail", "ho_staff_tab_overview", "ho_staff_tab_salary",
    "ho_staff_tab_history", "ho_staff_width_1440", "ho_staff_width_1024",
    "ho_staff_width_768", "ho_staff_width_390", "ho_staff_width_320",
    "ho_staff_back",
  ];
  const error = Object.assign(new Error("PRIVATE_EMAIL https://private.invalid/?token=secret"), {name:"TimeoutError"});
  for (const phase of [...studentPhases, ...staffPhases]) {
    const result = safeG4Failure("case", error, phase);
    assert.deepEqual(result, {name:"case",status:"FAIL",phase,errorType:"TimeoutError"});
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_EMAIL|private.invalid|secret/);
  }
  for (const phase of ["ho_staff_width_1", "student_table?record=private", "Bearer secret", "", "toString"]) {
    assert.equal(safeG4Failure("case", error, phase).phase, "unspecified");
  }
});

test("PAP-1394 HO Staff G4 source carries bounded phase callback without weakening assertions", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./run-tdd-g4-ci.mjs", import.meta.url),"utf8");
  const start = source.indexOf('await check("founder_ho_staff_table_drawer_full_detail"');
  assert.ok(start >= 0);
  const staff = source.slice(start, source.indexOf('} catch (error) {', start));
  assert.match(staff, /hoStaffPhase = "ho_staff_table"/);
  assert.match(staff, /hoStaffPhase = "ho_staff_drawer"/);
  assert.match(staff, /hoStaffPhase = "ho_staff_full_detail"/);
  assert.match(staff, /hoStaffPhase = "ho_staff_width_" \+ width/);
  assert.match(staff, /}, \(\) => hoStaffPhase\)/);
  assert.match(staff, /"HO overflow"/);
  assert.match(staff, /"stale record URL"/);
});
