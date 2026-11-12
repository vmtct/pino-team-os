/** PAP-1646 / Epic PAP-650 PNR-TV — strict Core projection guard; NOT auth. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePublishedTvPolicyProjection, type ViewerTrustedRequestContext } from "./pinoria-tv-viewer-published";

const centerId = "0199ce43-781b-7e14-8a72-836a2925f8a8";
const otherCenter = "0199ce43-781b-7e14-8a72-836a2925f8a9";
const ref = `tvp1-center-${centerId}`;
const baseContext: ViewerTrustedRequestContext = { policyRef: ref, centerId, surface: "TOS" };
const eventKinds = ["ARRIVAL", "QUICK_CHOICE", "DEPARTURE", "WISH_REVEAL", "EGG_HATCH", "COMPANION_RITUAL", "ONBOARDING_CEREMONY"];
// Event key fixed to match Core PAP-1650, no inference from TV Device.
function valid(): {data: Record<string, unknown>} {
  const events = Object.fromEntries(eventKinds.map(k => [k, {
    enabled: true, priority: 50, maxAgeSeconds: 120, suppressInQuietMode: false,
  }]));
  return { data: {
    policyRef: ref,
    selectedCenterId: centerId,
    type: "Ambient Welcome", aspectRatio: "16:9",
    scope: "CENTER", effectiveScope: "CENTER", inherited: false,
    appliedRevision: 3,
    configuration: {schemaVersion:1, quietMode:false, events,
      visibleContext: {name:true,path:true,room:false,companion:true,pls:false,fruit:false,highlight:false}},
  }};
}
function mutation(fn:(row:Record<string, unknown>)=>void): {data:Record<string,unknown>} {
  const obj=valid(); fn(obj.data); return obj;
}
test("PAP-1646 validates exact active Center-scoped projection envelope", () => {
  const result = parsePublishedTvPolicyProjection(valid(), baseContext);
  assert.ok(result);
  assert.equal(result.policyRef, ref);
  assert.equal(result.appliedRevision, 3);
  assert.equal(result.configuration.events.ARRIVAL.enabled, true);
});
test("PAP-1646 permits only Core-validated DEFAULT inheritance on a Center ref", () => {
  const inherited = mutation(r=>{r.effectiveScope="DEFAULT";r.inherited=true});
  const value = parsePublishedTvPolicyProjection(inherited,baseContext);
  assert.ok(value);
  assert.equal(value.inherited,true);
  assert.equal(parsePublishedTvPolicyProjection(mutation(r=>{r.effectiveScope="DEFAULT"}),baseContext),null);
  assert.equal(parsePublishedTvPolicyProjection(mutation(r=>{r.inherited=true}),baseContext),null);
});
test("PAP-1646 TOS never accepts direct DEFAULT Policy even if data shape valid", () => {
  const context = {policyRef:"tvp1-default",centerId,surface:"TOS"} as const;
  const data = mutation(r=>{r.policyRef="tvp1-default";r.scope="DEFAULT";r.effectiveScope="DEFAULT"});
  assert.equal(parsePublishedTvPolicyProjection(data,context),null);
  assert.ok(parsePublishedTvPolicyProjection(data,{...context,surface:"HO"}));
});
test("PAP-1646 denies cross-Center ref, selected Center and invalid untrusted context", () => {
  assert.equal(parsePublishedTvPolicyProjection(valid(),{...baseContext,centerId:otherCenter}),null);
  assert.equal(parsePublishedTvPolicyProjection(mutation(r=>{r.selectedCenterId=otherCenter}),baseContext),null);
  assert.equal(parsePublishedTvPolicyProjection(mutation(r=>{r.policyRef=`tvp1-center-${otherCenter}`}),baseContext),null);
  assert.equal(parsePublishedTvPolicyProjection(valid(),{...baseContext,policyRef:"../secret"}),null);
  assert.equal(parsePublishedTvPolicyProjection(valid(),{...baseContext,centerId:"BAD"}),null);
});
test("PAP-1646 rejects extra envelope fields, unpublished metadata or private Device payload", () => {
  const data=valid();
  assert.equal(parsePublishedTvPolicyProjection({...data,token:"secret"},baseContext),null);
  assert.equal(parsePublishedTvPolicyProjection(mutation(r=>{r.draftVersionId="secret"}),baseContext),null);
  assert.equal(parsePublishedTvPolicyProjection(mutation(r=>{r.deviceId="secret"}),baseContext),null);
  assert.equal(parsePublishedTvPolicyProjection({error:{code:"FORBIDDEN"}},baseContext),null);
  assert.equal(parsePublishedTvPolicyProjection({data:[],requestId:"123"},baseContext),null);
});
test("PAP-1646 rejects invalid revision, aspect, type, scope, inheritance and non-object data", () => {
  for(const f of [
    (r:Record<string,unknown>)=>{r.appliedRevision=0;},
    r=>{r.appliedRevision="3";},
    r=>{r.aspectRatio="9:16";},
    r=>{r.type="Kiosk";},
    r=>{r.scope="GLOBAL";},
    r=>{r.inherited="true";},
  ]) assert.equal(parsePublishedTvPolicyProjection(mutation(f),baseContext),null);
  for(const value of [null,undefined,[],{},200,{data:null},{data:{}}]) {
    assert.equal(parsePublishedTvPolicyProjection(value,baseContext),null);
  }
});
test("PAP-1646 rejects unknown config and privacy field shapes", () => {
  for(const change of [
    (config:Record<string,unknown>)=>{config.private="leak";},
    c=>{c.schemaVersion=2;},
    c=>{c.visibleContext={name:true};},
    c=>{c.events={};},
  ]) {
    const data=valid();change(data.data.configuration as Record<string,unknown>);
    assert.equal(parsePublishedTvPolicyProjection(data,baseContext),null);
  }
});
test("PAP-1646 refuses unauthorized, malformed or oversized event rule values", () => {
  for(const ruleChange of [
    (r:Record<string,unknown>)=>{r.priority=-1;},
    r=>{r.maxAgeSeconds=0;},
    r=>{r.enabled="true";},
    r=>{r.suppressInQuietMode=1;},
    r=>{r.privateStudentName="danger";},
  ]) {
    const data=valid();
    const config=data.data.configuration as Record<string,unknown>;
    const events=config.events as Record<string,unknown>;
    ruleChange(events.ARRIVAL as Record<string,unknown>);
    assert.equal(parsePublishedTvPolicyProjection(data,baseContext),null);
  }
});
test("PAP-1646 clones validated Core projection; future rendering still requires separate server auth", () => {
  const input=valid();
  const result=parsePublishedTvPolicyProjection(input,baseContext);
  assert.ok(result);
  const cfg = input.data.configuration as Record<string,unknown>;
  (cfg.visibleContext as Record<string,unknown>).name=false;
  assert.equal(result.configuration.visibleContext.name,true);
});
