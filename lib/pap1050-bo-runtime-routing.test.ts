import test from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../middleware";
const HOST="bo.staging.pinohouse.art";
test("PAP-1050 authenticated legacy Subscription route aliases to canonical BO query with Student context",()=>{
  const request=new NextRequest("https://"+HOST+"/bo/subscriptions?studentId=019d9881-1025-7000-8000-000000000144",{headers:{host:HOST,cookie:"pino_staff_password_session=fixture-only"}});
  const response=middleware(request);
  assert.equal(response.status,307);
  const url=new URL(response.headers.get("location")||"");
  assert.equal(url.origin,"https://"+HOST);
  assert.equal(url.pathname,"/bo");
  assert.equal(url.searchParams.get("module"),"subscriptions");
  assert.equal(url.searchParams.get("studentId"),"019d9881-1025-7000-8000-000000000144");
});
test("PAP-1050 canonical BO Subscription route remains auth protected before rendering",()=>{
  const response=middleware(new NextRequest("https://"+HOST+"/bo?module=subscriptions",{headers:{host:HOST}}));
  assert.equal(response.status,307);
  const login=new URL(response.headers.get("location")!); assert.equal(login.origin,"https://"+HOST); assert.equal(login.pathname,"/staff-login"); assert.equal(login.searchParams.get("returnTo"),"/bo?module=subscriptions");
});
test("PAP-1050 BO Subscription legacy alias cannot be spoofed via lookalike host",()=>{
  const host="bo.staging.pinohouse.art.evil.example";
  const response=middleware(new NextRequest("https://"+host+"/bo/subscriptions",{headers:{host}}));
  assert.notEqual(response.headers.get("location"),"https://"+host+"/bo?module=subscriptions");
});

test("PAP-2203 cold legacy Subscription alias retains Student context through auth",()=>{
 const studentId="019d9881-1025-7000-8000-000000000144";
 const first=middleware(new NextRequest("https://"+HOST+"/bo/subscriptions?studentId="+studentId));
 assert.equal(first.status,307);
 const second=middleware(new NextRequest(first.headers.get("location")!));
 assert.equal(second.status,307);
 const login=new URL(second.headers.get("location")!);
 assert.equal(login.origin,"https://"+HOST);
 assert.equal(login.pathname,"/staff-login");
 const target=new URL(login.searchParams.get("returnTo")!,login.origin);
 assert.equal(target.pathname,"/bo");
 assert.equal(target.searchParams.get("module"),"subscriptions");
 assert.equal(target.searchParams.get("studentId"),studentId);
});
