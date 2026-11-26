import { NextRequest, NextResponse } from "next/server";
import { HO_STAGING_HOSTNAME, normalizeHostname, decideHostBoundary, requiresBoStaffPasswordSession, requiresTosStaffSession } from "@/lib/host-boundary";
import { boSkeletonRoute, isBoStagingHost, requiresBoStagingPageSession } from "@/lib/bo-skeleton-routing";
import { safeHoReturnTo } from "@/lib/ho-routes";
import { BO_RETURN_HEADER, BO_STAGING_RETURN_HOST, safeBoStagingReturnTo } from "@/lib/bo-staging-return-to";

import {RC_REVIEW_PATH} from "@/app/bo/running-classes/running-class-review-query";
import {parseRunningClassStageQuery} from "@/app/bo/running-classes/running-class-stage-admission";
import { parseNativePostQuery } from "@/app/bo/piner-posts/native-post-query";
import {invalidStaffPhaseOneRequest} from "@/app/ho/staff/staff-phase-one-route";

export function middleware(request: NextRequest) {
  // Source assets are served only through the authenticated staging controller.
  if (request.nextUrl.pathname.startsWith("/bo-authority-source/")) return new NextResponse("Not Found", { status: 404 });
  const host = request.headers.get("host") ?? request.nextUrl.hostname;
  // PAP-2181: retire the legacy BO Session Registration UI on Staging only.
  // Never reinterpret a Session/Registration ID as an Enrollment record ID.
  if (normalizeHostname(host) === "bo.staging.pinohouse.art" && (request.method === "GET" || request.method === "HEAD")) {
    const path=request.nextUrl.pathname, query=request.nextUrl.searchParams;
    const oldRegistration=path==="/bo/registrations"||path==="/bo/registrations/";
    const oldEnrollment=(path==="/bo"||path==="/bo/")&&query.getAll("module").length===1&&query.get("module")==="enrollments";
    if(oldRegistration||oldEnrollment){
      const target=request.nextUrl.clone();target.pathname="/bo/enrollments";target.search="";
      const centers=query.getAll("centerId");
      if(centers.length>1||centers.length===1&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(centers[0]!))return new NextResponse("Invalid Center", {status:400,headers:{"cache-control":"no-store"}});
      if(centers.length===1)target.searchParams.set("centerId",centers[0]!);
      const records=query.getAll("record");
      if(oldEnrollment&&records.length===1&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(records[0]!))target.searchParams.set("record",records[0]!);
      return NextResponse.redirect(target,307);
    }
  }
  // Legacy dedicated Subscription URLs are aliases, NOT staging route admissions.
  // One canonical /bo React shell owns the module; existing bookmarks are preserved.
  if (isBoStagingHost(host) && (request.nextUrl.pathname === "/bo/subscriptions" || request.nextUrl.pathname === "/bo/subscriptions/")) {
    const target = request.nextUrl.clone();
    target.pathname = "/bo";
    target.searchParams.set("module", "subscriptions");
    return NextResponse.redirect(target, 307);
  }
  // PAP-1224: BO Staging-only compatibility redirect; keep Production Open Studio unchanged.
  if (isBoStagingHost(host) && ["/bo/open-studio","/bo/open-studio/"].includes(request.nextUrl.pathname)) {
    const target=request.nextUrl.clone();
    target.pathname="/bo/open-studio-passes";
    target.search="";
    return NextResponse.redirect(target,307);
  }
  // Never trust a caller-supplied internal route marker.
  const forwarded = new Headers(request.headers);
  forwarded.delete("x-pino-bo-runtime-path");
  forwarded.delete(BO_RETURN_HEADER);
  if(normalizeHostname(host)===BO_STAGING_RETURN_HOST){
    const ret=safeBoStagingReturnTo(request.nextUrl.pathname+request.nextUrl.search);
    if(ret)forwarded.set(BO_RETURN_HEADER,ret);
  }
  forwarded.delete("x-pino-ho-auth-page");
  forwarded.delete("x-pino-ho-return-to");
  if (normalizeHostname(host) === HO_STAGING_HOSTNAME && request.nextUrl.pathname.startsWith("/ho")) {
    const ret = safeHoReturnTo(request.nextUrl.pathname + request.nextUrl.search);
    if (ret) forwarded.set("x-pino-ho-return-to",ret);
  }
  if (requiresBoStagingPageSession(host, request.nextUrl.pathname) || requiresBoStaffPasswordSession(host, request.nextUrl.pathname)) forwarded.set("x-pino-bo-runtime-path", request.nextUrl.pathname);
  // Public Staff auth pages must not load the restricted HO authority CSS.
  // The marker is set by middleware, never trusted from caller headers.
  if (normalizeHostname(host) === HO_STAGING_HOSTNAME &&
      ["/staff-login", "/staff-password/change"].includes(request.nextUrl.pathname)) {
    forwarded.set("x-pino-ho-auth-page", "1");
  }
  // PAP-1460 / PNR-TV: retired BO TV route must answer 404 before any
  // BO skeleton or old-host redirects; no login/HO redirect or domain fetch.
  if (/^\/bo\/tvs(?:\/|$)/i.test(request.nextUrl.pathname))
    return new NextResponse("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  const schoolRoute = boSkeletonRoute(host, request.nextUrl.pathname);
  if (schoolRoute === "redirect") {
    const target = request.nextUrl.clone();
    target.pathname = "/bo";
    return NextResponse.redirect(target, 307);
  }
  const decision = decideHostBoundary(host, request.nextUrl.pathname, request.method);

  if (decision.action === "next") {
    if (normalizeHostname(host) === HO_STAGING_HOSTNAME && request.nextUrl.pathname.startsWith("/ho") && !request.cookies.get("pino_staff_password_session")?.value) {
      const login = new URL("/staff-login", request.url);
      const ret = safeHoReturnTo(request.nextUrl.pathname + request.nextUrl.search);
      if (ret) login.searchParams.set("returnTo", ret);
      return NextResponse.redirect(login, 307);
    }
    if (requiresTosStaffSession(host, request.nextUrl.pathname) && !request.cookies.get("pino_support_session")?.value && !request.cookies.get("pino_staff_password_session")?.value) {
      const login = new URL(request.url); login.pathname = "/staff-login"; login.search = "";
      return NextResponse.redirect(login, 307);
    }
    // Before React starts streaming: an async layout redirect can otherwise be HTTP 200.
    if ((requiresBoStaffPasswordSession(host, request.nextUrl.pathname) || requiresBoStagingPageSession(host, request.nextUrl.pathname)) && !request.cookies.get("pino_staff_password_session")?.value) {
      const login = new URL(request.url); login.pathname = "/staff-login"; login.search = "";
      if (normalizeHostname(host) === BO_STAGING_RETURN_HOST && ["GET","HEAD"].includes(request.method)) {
        const ret = safeBoStagingReturnTo(request.nextUrl.pathname + request.nextUrl.search);
        if (ret) login.searchParams.set("returnTo",ret);
      }
      return NextResponse.redirect(login, 307);
    }
    if (isBoStagingHost(host) && request.nextUrl.pathname===RC_REVIEW_PATH && ["GET","HEAD"].includes(request.method)) {
      const params=new URLSearchParams(request.nextUrl.searchParams);if(request.headers.get("rsc")==="1")params.delete("_rsc");
      if(parseRunningClassStageQuery(params)===null)return new NextResponse("Not Found",{status:404,headers:{"cache-control":"no-store"}});
    }
    // PAP-2386: reject invalid canonical native Post links before streaming.
    if (normalizeHostname(host) === BO_STAGING_RETURN_HOST && request.nextUrl.pathname === "/bo/piner-posts" && ["GET","HEAD"].includes(request.method)) {
      const params=new URLSearchParams(request.nextUrl.searchParams);
      // Next internal RSC cache key is transport metadata, not fixture state.
      if(request.headers.get("rsc")==="1")params.delete("_rsc");
      if(!parseNativePostQuery(params))return new NextResponse("Not Found",{status:404,headers:{"cache-control":"no-store"}});
    }
    // PAP-2395: once native Staff is admitted, reject malformed links before streaming.
    if(invalidStaffPhaseOneRequest(normalizeHostname(host),request.nextUrl.pathname,request.method,request.nextUrl.searchParams,request.headers.get("rsc")))
      return new NextResponse("Not Found",{status:404,headers:{"cache-control":"no-store"}});
    // PAP-2369: exact canonical synthetic-only HO preview, reject invalid links before streaming.
    if(normalizeHostname(host)===HO_STAGING_HOSTNAME && request.nextUrl.pathname==="/ho/learning-spaces" && ["GET","HEAD"].includes(request.method)){
      const params=new URLSearchParams(request.nextUrl.searchParams);
      if(request.headers.get("rsc")==="1")params.delete("_rsc");
      if(!safeHoReturnTo(request.nextUrl.pathname+(params.size?"?"+params.toString():"")))return new NextResponse("Not Found",{status:404,headers:{"cache-control":"no-store"}});
    }
    // PAP-2373: reject retired Role fixtures and malformed native links before streaming.
    if(normalizeHostname(host)===HO_STAGING_HOSTNAME && request.nextUrl.pathname==="/ho/system/roles" && ["GET","HEAD"].includes(request.method)){
      const params=new URLSearchParams(request.nextUrl.searchParams);
      if(request.headers.get("rsc")==="1")params.delete("_rsc");
      if(!safeHoReturnTo(request.nextUrl.pathname+(params.size?"?"+params.toString():"")))return new NextResponse("Not Found",{status:404,headers:{"cache-control":"no-store"}});
    }
    return NextResponse.next({ request: { headers: forwarded } });
  }
  if (decision.action === "not_found") {
    return new NextResponse("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const destination = new URL(request.url);
  destination.host = request.headers.get("host") ?? request.nextUrl.host;
  destination.pathname = decision.pathname;
  destination.search = "";
  return NextResponse.redirect(destination, 307);
}
