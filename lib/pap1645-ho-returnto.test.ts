import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { HO_HOME_PATH, safeHoReturnTo } from "./ho-routes";

const route="/ho/learning/specialties";
const origin="https://ho.staging.pinohouse.art";
const caseUrl=route+"?utm_source=chatgpt.com";

test("PAP-1645: approved deep link strips trusted-shape UTM metadata, keeps HO route",()=>{
  assert.equal(safeHoReturnTo(route),route);
  assert.equal(safeHoReturnTo(caseUrl),route);
  assert.equal(safeHoReturnTo(route+"?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=S3"),route);
  assert.equal(safeHoReturnTo(route+"?utm_content=https%3A%2F%2Fevil.example"),route);
  assert.equal(safeHoReturnTo("/ho/centers?record=abc_123-45&utm_source=chatgpt.com"),"/ho/centers?record=abc_123-45");
  assert.equal(HO_HOME_PATH,"/ho/centers");
});
test("PAP-1645: safe return target still rejects unknown keys, duplicate records, path tricks",()=>{
  for(const u of [
    route+"?redirect=https%3A%2F%2Fevil.example",route+"?utm_source=chatgpt.com&redirect=%2Fho%2Fcenters",
    route+"?record=first&record=second&utm_medium=affiliate",
    "/ho/centers?record=%2Fho%2Flearning%2Fspecialties&utm_source=chatgpt.com",
    "/ho/unknown?utm_source=chatgpt.com",
    "//evil.example/ho/learning/specialties?utm_source=chatgpt.com",
    "https://evil.example/ho/learning/specialties?utm_source=chatgpt.com",
    route+"?utm_source=chatgpt.com#frag",
  ]) assert.equal(safeHoReturnTo(u),null,u);
});
test("PAP-1645: unauthenticated tracked click redirects to login with safe returnTo",()=>{
  for(const path of [route,caseUrl]){
    const response=middleware(new NextRequest(origin+path));
    assert.equal(response.status,307,path);
    const destination=new URL(response.headers.get("location")||"",origin);
    assert.equal(destination.pathname,"/staff-login",path);
    assert.equal(destination.searchParams.get("returnTo"),route,path);
  }
});
