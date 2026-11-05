import test from "node:test";
import assert from "node:assert/strict";
import {matchesPlatform,permissionPlatforms,permissionPlatformCounts,bulkGroupPermissionKeys} from "../app/ho/system/roles/HoRoleEditor";

test("PAP-1507: BO/TOS authorization surface is not UI platform applicability",()=>{
  assert.deepEqual(permissionPlatforms({}),[]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"BO"} as never),[]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"TOS"} as never),[]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"BOTH"} as never),[]);
  assert.deepEqual(permissionPlatforms({applicablePlatforms:null}),[]);
  assert.deepEqual(permissionPlatforms({applicablePlatforms:[]}),[]);
});
test("PAP-1507: explicit Core platform metadata may be shared or unclassified",()=>{
  const p={surfaceApplicability:"TOS",applicablePlatforms:["HO","BO","BO","TOS"] as const};
  assert.deepEqual(permissionPlatforms(p),["HO","BO","TOS"]);
  assert.equal(matchesPlatform(p,"HO"),true);
  assert.equal(matchesPlatform({surfaceApplicability:"BO",applicablePlatforms:[]}, "BO"),false);
  assert.equal(matchesPlatform({applicablePlatforms:null},"all"),true);
});
test("PAP-1507: counts only catalog-backed UI platforms, never inferred defaults",()=>{
  const catalog=[
    {key:"legacy-only",surfaceApplicability:"BO"},
    {key:"bo-only",surfaceApplicability:"BO",applicablePlatforms:["BO"] as const},
    {key:"shared",surfaceApplicability:"BOTH",applicablePlatforms:["BO","TOS"] as const},
    {key:"tos",surfaceApplicability:"TOS",applicablePlatforms:["TOS"] as const},
    {key:"ho",surfaceApplicability:"BO",applicablePlatforms:["HO"] as const},
    {key:"unknown",surfaceApplicability:"BO",applicablePlatforms:null},
  ];
  assert.deepEqual(permissionPlatformCounts(catalog),{all:6,HO:1,BO:2,TOS:2});
  assert.equal(matchesPlatform(catalog[0],"BO"),false);
  assert.equal(matchesPlatform(catalog[5],"all"),true);
  const selected=["bo-only","tos","unknown"];
  const changed=bulkGroupPermissionKeys(selected,catalog.filter(p=>matchesPlatform(p,"BO")).map(p=>p.key));
  assert.deepEqual(changed,["bo-only","shared","tos","unknown"].sort());
});
