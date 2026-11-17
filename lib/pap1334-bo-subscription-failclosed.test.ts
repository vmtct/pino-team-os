/** PAP-1334 / PAP-1491 SPEC-UNLOCK — native read-only and legacy writer containment. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const runtime=readFileSync(new URL("../app/bo/components/registration/BoRuntimeBoundary.tsx",import.meta.url),"utf8");
const workspace=readFileSync(new URL("../app/bo/components/registration/BoRegistrationWorkspace.tsx",import.meta.url),"utf8");
const middleware=readFileSync(new URL("../middleware.ts",import.meta.url),"utf8");
const native=readFileSync(new URL("../app/bo/subscriptions/SubscriptionDirectoryDsa.tsx",import.meta.url),"utf8");
const model=readFileSync(new URL("./pap1334-native-subscription-read.ts",import.meta.url),"utf8");
const legacy=readFileSync(new URL("../app/bo/subscriptions/BoSubscriptionsView.tsx",import.meta.url),"utf8");

test("PAP-1334: Subscription route mounts ONLY the new PINO native read-only DSA, never legacy writer",()=>{
 assert.match(runtime,/if \(moduleKey === "subscriptions"\) return <BoRegistrationWorkspace/);
 assert.match(runtime,/content=\{<SubscriptionDirectoryDsa \/>\}/);
 assert.doesNotMatch(runtime,/<BoSubscriptionsView\b/);
 assert.doesNotMatch(runtime,/import \{ BoSubscriptionsView \}/);
 assert.doesNotMatch(runtime,/data-testid="bo-subscription-center-contract-pending"/);
});

test("PAP-1334: new DSA owns Center selection and Core-attested Table/Drawer/Detail",()=>{
 assert.match(workspace,/if \(content\) \{ document\.title = definition\.label[\s\S]*?return; \}/);
 assert.match(native,/useBoCenterSelection\(/);
 assert.match(native,/key=\{selected\+":"\+center\.source\}/);
 assert.match(native,/loadCenterSubscriptionDirectory\(centerId,ctl\.signal\)/);
 assert.match(native,/assertCenterDetail\(/);
 assert.match(native,/readSubscriptionCenterDetail\(item\.id,centerId,ctl\.signal\)/);
 assert.match(native,/BoDataTable/);
 assert.match(native,/BoQuickView/);
 assert.match(native,/DetailFrame/);
 assert.doesNotMatch(native,/subscriptionById|renewSubscription|cancelSubscription|createSubscription|endEnrollment/);
 assert.match(model,/\/api\/bo\/subscriptions\/center-directory/);
 assert.doesNotMatch(model,/return "\/api\/bo\/subscriptions\?"/);
 assert.match(middleware,/request\.nextUrl\.pathname === "\/bo\/subscriptions"/);
});

test("PAP-1334: legacy code remains for audit and is NEVER mounted as an active BO Subscription UI",()=>{
 assert.match(legacy,/renewSubscription\(/);
 assert.match(legacy,/endEnrollment\(/);
 assert.match(runtime,/PAP-1350 must first land an independently authorized Center writer/);
});

test("PAP-1334: switching Center closes old record deep-link and invalidates stale fetch",()=>{
 assert.match(native,/previousCenter\.current!==selected/);
 assert.match(native,/url\.searchParams\.delete\("record"\)/);
 assert.match(native,/key=\{selected\+":"\+center\.source\}/);
 assert.match(native,/ctl\.abort\(\)/);
 assert.match(native,/detailController\.current\?\.abort\(\)/);
});
