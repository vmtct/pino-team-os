import test from "node:test";
import assert from "node:assert/strict";
import {matchesPlatform,permissionPlatforms,permissionPlatformCounts,bulkGroupPermissionKeys} from "../app/ho/system/roles/HoRoleEditor";

test("PAP-1507: Team OS legacy applicability exposes only BO/TOS, never guesses HO",()=>{
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"BO"}),["BO"]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"TOS"}),["TOS"]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"BOTH"}),["BO","TOS"]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"UNKNOWN"}),[]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"BO",applicablePlatforms:null}),[]);
  assert.deepEqual(permissionPlatforms({surfaceApplicability:"BO",applicablePlatforms:[]}),[]);
});
test("PAP-1507: explicit Core platform metadata wins and can be shared or unknown",()=>{
  const p={surfaceApplicability:"TOS",applicablePlatforms:["HO","BO","BO","TOS"] as const};
  assert.deepEqual(permissionPlatforms(p),["HO","BO","TOS"]);
  assert.equal(matchesPlatform(p,"HO"),true);
  assert.equal(matchesPlatform({surfaceApplicability:"BO",applicablePlatforms:[]},"BO"),false);
});
test("PAP-1507: counts represent catalog entries, not role selected keys or key prefixes",()=>{
  const catalog=[
    {key:"system.ho.magic",surfaceApplicability:"BO"},
    {key:"bo.only",surfaceApplicability:"BO"},
    {key:"shared",surfaceApplicability:"BOTH"},
    {key:"tos",surfaceApplicability:"TOS"},
    {key:"ho",surfaceApplicability:"BOTH",applicablePlatforms:["HO"] as const},
    {key:"unknown",surfaceApplicability:null},
  ];
  assert.deepEqual(permissionPlatformCounts(catalog),{all:6,HO:1,BO:3,TOS:2});
  assert.equal(matchesPlatform(catalog[0],"HO"),false);
  assert.equal(matchesPlatform(catalog[5],"all"),true);
  const selected=["bo.only","tos","unknown"];
  const changed=bulkGroupPermissionKeys(selected,catalog.filter(p=>matchesPlatform(p,"BO")).map(p=>p.key));
  assert.deepEqual(changed,["bo.only","shared","system.ho.magic","tos","unknown"].sort());
});
