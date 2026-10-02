import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {isAllowedPostPath} from "./bo-write-handler";

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),"utf8");
const id="01990000-0000-7000-8000-000000000001";

test("BO exposes starter capability plus one-time Student and Staff grant controls",()=>{
  const sets=read("app/bo/pinoria-ward/sets/WardSetManager.tsx");
  const student=read("app/bo/learners/StudentPinoriaPanel.tsx");
  const staff=read("app/bo/staff/StaffManagementView.tsx");
  const api=read("lib/bo-api.ts");
  assert.match(sets,/Available as starter/);
  assert.match(sets,/WEBM is optional/);
  assert.match(sets,/pinoria\/onboarding\/sets\/\$\{selected\.id\}/);
  assert.match(student,/Allow onboarding ceremony|Enable ceremony again/);
  assert.match(staff,/Allow onboarding ceremony|Enable ceremony again/);
  assert.match(api,/grantStudentPinoriaOnboarding/);
  assert.match(api,/grantStaffPinoriaOnboarding/);
  assert.match(api,/revokeStudentPinoriaOnboarding/);
  assert.match(api,/revokeStaffPinoriaOnboarding/);
});

test("BO facade bounds onboarding mutations to Set capability and recipient grants",()=>{
  assert.equal(isAllowedPostPath(`pinoria/onboarding/sets/${id}`),true);
  assert.equal(isAllowedPostPath(`pinoria/onboarding/students/${id}/grant`),true);
  assert.equal(isAllowedPostPath(`pinoria/onboarding/staff/${id}/grant`),true);
  assert.equal(isAllowedPostPath(`pinoria/onboarding/students/${id}/character`),false);
  const handler=read("lib/bo-write-handler.ts");
  assert.match(handler,/PINORIA_ONBOARDING_SET_WRITE/);
  assert.match(handler,/PINORIA_ONBOARDING_GRANT_WRITE/);
  assert.match(handler,/request\.method === "DELETE"/);
});

test("TOS controller is a contextual Pinoria flow and commits only after exact Set selection",()=>{
  const desk=read("app/pinoria/onboarding/OnboardingCeremonyDesk.tsx");
  const nav=read("app/components/tos-shell/navigation.ts");
  assert.match(nav,/id: "onboarding".*href: "\/pinoria\/onboarding"/);
  assert.match(desk,/pinoria\/onboarding\/recipients/);
  assert.match(desk,/pinoria\/onboarding\/sessions/);
  assert.match(desk,/\/select/);
  assert.match(desk,/\/commit/);
  assert.match(desk,/selectionStale/);
  assert.match(desk,/Bắt đầu hành trình/);
  assert.match(desk,/WEBM là optional/);
});

test("PINORIA_HOUSE runtime previews open ceremony and reveals committed presentation",()=>{
  const binding=read("lib/tv-runtime-core.ts");
  const previewRoute=read("app/api/tv/runtime/[displayId]/pinoria-house/onboarding-preview/route.ts");
  const reception=read("app/pinoria-tv/reception-tv.tsx");
  const scene=read("app/pinoria-tv/onboarding-ceremony-scene.tsx");
  const types=read("app/pinoria-tv/presentation-types.ts");
  assert.match(binding,/onboardingPreview/);
  assert.match(previewRoute,/PINO_TV_RUNTIME_CORE\.onboardingPreview/);
  assert.match(reception,/onboarding-preview/);
  assert.match(reception,/ONBOARDING_CEREMONY/);
  assert.match(types,/kind: "ONBOARDING_CEREMONY"/);
  assert.match(scene,/selectionStale/);
  assert.match(scene,/mode:set\.webmAssetKey\?"SET_WEBM":"LAYERED"/);
  assert.match(scene,/LayeredCharacter/);
});

test("first check-in UI no longer asks for a Character preset",()=>{
  const arrival=read("app/pinoria/arrival-desk.tsx");
  assert.doesNotMatch(arrival,/presetId|character preset|Chọn nhân vật/i);
  assert.match(arrival,/check.?in|checkIn/i);
});
