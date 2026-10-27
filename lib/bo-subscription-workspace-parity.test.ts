import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=(path:string)=>readFileSync(path,"utf8");
const workspace=source("app/bo/components/registration/BoRegistrationWorkspace.tsx");
const runtime=source("app/bo/components/registration/BoRuntimeBoundary.tsx");
const subscription=source("app/bo/subscriptions/BoSubscriptionsView.tsx");
const scopedCss=source("app/bo/subscriptions/bo-subscriptions.module.css");

test("PAP-1081 Subscription must consume BO Workspace-owned mobile sidebar state",()=>{
 assert.match(workspace,/function menu\(id: string\)/);
 assert.match(workspace,/aria-expanded=\{mobileOpen\}/);
 assert.match(workspace,/aria-controls="sidebar"/);
 assert.match(workspace,/onClick=\{\(\) => setMobileOpen\(v => !v\)\}/);
 assert.match(workspace,/renderContent \? renderContent\(menu\)/);
 assert.match(runtime,/renderContent=\{moduleKey === "subscriptions" \? mobileMenu => <BoSubscriptionsView embedded mobileMenu=\{mobileMenu\} \/> : undefined\}/);
 assert.match(subscription,/mobileMenu\?\.\("subscription-menu-btn"\)/);
 assert.match(subscription,/mobileMenu=\{mobileMenu\?\.\("subscription-detail-menu-btn"\) \?\? null\}/);
 assert.doesNotMatch(subscription,/mobileMenu=\{null\}/);
});

test("PAP-1081 Subscription uses canonical BO page heading and action chrome, never scoped heading fork",()=>{
 assert.match(subscription,/<header className="page-heading">/);
 assert.match(subscription,/<div className="page-heading-left">/);
 assert.match(subscription,/<div className="heading-actions">/);
 assert.match(subscription,/<h1>Subscriptions<\/h1>/);
 assert.doesNotMatch(subscription,/styles\.readHeading/);
 assert.doesNotMatch(scopedCss,/\.readHeading\b/);
});

test("PAP-1081 keeps an explicit no-menu fallback only for standalone non-staging route",()=>{
 assert.match(subscription,/mobileMenu\?: \(id: string\) => React\.ReactNode/);
 assert.match(subscription,/mobileMenu\?\.\("subscription-menu-btn"\)/);
 assert.match(runtime,/moduleKey === "subscriptions"/);
});
