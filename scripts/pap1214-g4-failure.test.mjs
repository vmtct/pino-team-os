import test from "node:test";
import assert from "node:assert/strict";
import { safeG4Failure, safeG4SurfaceProbe, safeG4HoStaffProbe } from "./pap1214-g4-failure.mjs";

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
  const end = source.indexOf("}, () => hoStaffPhase);", start);
  assert.ok(end > start);
  const staff = source.slice(start, end + "}, () => hoStaffPhase);".length);
  assert.match(staff, /hoStaffPhase = "ho_staff_table"/);
  assert.match(staff, /hoStaffPhase = "ho_staff_drawer"/);
  assert.match(staff, /hoStaffPhase = "ho_staff_full_detail"/);
  assert.match(staff, /hoStaffPhase = "ho_staff_width_" \+ width/);
  assert.match(staff, /}, \(\) => hoStaffPhase\)/);
  assert.match(staff, /"HO overflow"/);
  assert.match(staff, /"stale record URL"/);
});


test("PAP-1397 cold Center G4 phase is safe and UI selection stays Core-authorized", async () => {
  const err = Object.assign(new Error("PRIVATE_EMAIL https://private.invalid/token=secret"), {name:"TimeoutError"});
  const failure = safeG4Failure("student_to_real_subscription_full_detail", err, "student_center_context");
  assert.deepEqual(failure, {
    name:"student_to_real_subscription_full_detail", status:"FAIL",
    phase:"student_center_context", errorType:"TimeoutError",
  });
  assert.doesNotMatch(JSON.stringify(failure), /PRIVATE_EMAIL|secret|private.invalid/);
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./run-tdd-g4-ci.mjs", import.meta.url),"utf8");
  const start = source.indexOf('await check("student_to_real_subscription_full_detail"');
  const end = source.indexOf('await check("founder_ho_staff_table_drawer_full_detail"', start);
  assert.ok(start >= 0 && end > start);
  const student = source.slice(start,end);
  assert.match(student, /section\[aria-label="Chọn cơ sở cho module"\]/);
  assert.match(student, /button\.nav-workspace\[aria-haspopup="listbox"\]/);
  assert.match(student, /#workspace-centers \[role="option"\]/);
  assert.match(student, /await authorizedOptions\.first\(\)\.waitFor/);
  assert.match(student, /await authorizedOptions\.nth\(index\)\.click\(\)/);
  assert.match(student, /for \(let index = 0; index < centerCount; index\+\+\)/);
  assert.match(student, /data-record/);
  assert.match(student, /visibleIds\.has\(candidate\.id\)/);
  assert.match(student, /No subscribed Student in an authorized Center/);
  assert.match(student, /await studentRow\.waitFor/);
  assert.match(student, /await studentRow\.click\(\)/);
  assert.match(student, /studentSubscriptionPhase = "student_table"/);
  assert.match(student, /No subscribed Student/);
  assert.match(student, /wrong opened Subscription/);
});

test("PAP-1398 read-only HO Staff diagnostic emits only booleans and HTTP status", async () => {
  const flags = {
    expectedHost: true, staffRoute: true, loginRoute: false,
    tablePresent: false, alertPresent: false, statusPresent: true,
    contextHTTP: 200, staffHTTP: 403,
    email: "PRIVATE_EMAIL", cookie:"secret", url:"https://private.invalid/a",
  };
  const result = safeG4HoStaffProbe(flags);
  assert.deepEqual(result, {
    expectedHost:true, staffRoute:true, loginRoute:false,
    tablePresent:false, alertPresent:false, statusPresent:true,
    contextHTTP:200, staffHTTP:403,
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_EMAIL|secret|private.invalid|cookie|url/);
  assert.equal(safeG4HoStaffProbe({contextHTTP:"200",staffHTTP:999}).contextHTTP,0);
  assert.equal(safeG4HoStaffProbe({contextHTTP:"200",staffHTTP:999}).staffHTTP,0);
  assert.equal(safeG4HoStaffProbe({expectedHost:1,alertPresent:"true"}).expectedHost,false);
  assert.equal(safeG4HoStaffProbe({expectedHost:1,alertPresent:"true"}).alertPresent,false);
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./run-tdd-g4-ci.mjs",import.meta.url),"utf8");
  const start = source.indexOf('await check("founder_ho_staff_table_drawer_full_detail"');
  assert.ok(start >= 0);
  const ho = source.slice(start);
  assert.match(ho, /hoStaffPhase = "ho_staff_table"/);
  assert.match(ho, /PAP-1398_HO_STAFF_READONLY_PROBE/);
  assert.match(ho, /safeG4HoStaffProbe\(flags\)/);
  assert.match(ho, /getStatus\("\/api\/bo\/context"\)/);
  assert.match(ho, /getStatus\("\/api\/bo\/workforce\/staff-records"\)/);
  assert.match(ho, /throw error/);
  assert.match(ho, /"stale record URL"/);
});


test("PAP-1397 scopes subscribed Student selection to UI-visible canonical record identity", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./run-tdd-g4-ci.mjs", import.meta.url),"utf8");
  const start = source.indexOf('await check("student_to_real_subscription_full_detail"');
  const end = source.indexOf('await check("founder_ho_staff_table_drawer_full_detail"', start);
  const student = source.slice(start, end);
  assert.match(student, /filter\(s => s\.activeSubscriptions > 0/);
  assert.match(student, /document\.querySelectorAll\('#typed-table tbody tr\[data-record\]'\)/);
  assert.match(student, /return candidates\.find\(candidate => visibleIds\.has\(candidate\.id\)\) \?\? null/);
  assert.match(student, /selectedSubscriber = await match\.jsonValue\(\)/);
  assert.match(student, /main input\[type="search"\]'\)\.fill\(selectedSubscriber\.name\)/);
  assert.match(student, /data-record="' \+\s*selectedSubscriber\.id/);
  assert.match(student, /wrong opened Subscription/);
  assert.doesNotMatch(student, /centerId\s*=\s*["']?[0-9a-f]{8}-/i);
});
