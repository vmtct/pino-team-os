/** PAP-1810 / Epic PAP-1705 PNR-AVATAR-CRUD:
 * An exact Founder-directed Avatar native DSA migration, not a universal TDD escape hatch.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, isFounderMigratedBoAvatarNativeDsaRoute } from "./verify-tdd-authority.mjs";

test("PAP-1810 exact Avatar BO TDD admission retirement requires native DSA route, Core auth and Create", t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"pap1810-native-retire-"));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const files=[
    "app/bo/pinoria-avatars/page.tsx",
    "app/bo/pinoria-avatars/AvatarDirectoryDsa.tsx",
    "app/bo/pinoria-avatars/avatar-dsa-data.ts",
    "app/bo/pinoria-avatars/avatar-dsa-model.ts",
    "app/bo/pinoria-avatars/CreateSelfDrawer.tsx",
    "app/bo/pinoria-avatars/SelfWardrobeDetail.tsx",
    "app/bo/pinoria-avatars/SelfLoadoutDetail.tsx",
    "lib/pap1810-avatar-native-dsa.test.ts",
  ];
  for(const file of files){
    fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});
    fs.copyFileSync(path.join(ROOT,file),path.join(temp,file));
  }
  const entry={file:files[0],route:"/bo/pinoria-avatars",key:"pinoria-avatars",surface:"BO",profile:"TDD_DEFAULT"};
  assert.equal(isFounderMigratedBoAvatarNativeDsaRoute(temp,entry),true);
  for(const wrong of [
    {...entry,route:"/bo/another"},
    {...entry,key:"staff"},
    {...entry,surface:"HO"},
    {...entry,profile:"EXISTING_GRANDFATHERED"},
  ])assert.equal(isFounderMigratedBoAvatarNativeDsaRoute(temp,wrong),false);
  const mutate=(file,transform)=>{
    const p=path.join(temp,file),old=fs.readFileSync(p,"utf8"),next=transform(old);
    assert.notEqual(next,old,file);
    fs.writeFileSync(p,next);
    assert.equal(isFounderMigratedBoAvatarNativeDsaRoute(temp,entry),false,file);
    fs.writeFileSync(p,old);
  };
  mutate(files[0],s=>s.replace("<AvatarDirectoryDsa />","<SelfDirectoryTdd />"));
  mutate(files[1],s=>s.replaceAll("loadAvatarContext","unsafeLocalContext"));
  mutate(files[2],s=>s.replace("pinoria.avatar.directory.view","unrestricted.directory.view"));
  mutate(files[4],s=>s.replace('method:"POST"','method:"GET"'));
  fs.rmSync(path.join(temp,files[2]));
  assert.equal(isFounderMigratedBoAvatarNativeDsaRoute(temp,entry),false);
});
