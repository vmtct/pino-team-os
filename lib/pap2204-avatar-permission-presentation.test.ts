import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarPermissionPresentation, avatarPermissionSection } from "./avatar-permission-presentation";
const p = (key: string, domain = "pinoria") => Object.freeze({key, domain});
test("only exact existing scoped identities get display classification", () => {
  assert.equal(avatarPermissionSection(p("pinoria.avatar.directory.view")), "profile");
  assert.equal(avatarPermissionSection(p("pinoria.self.item.manage")), "item");
  assert.equal(avatarPermissionSection(p("pinoria.self.loadout.view")), "loadout");
  assert.equal(avatarPermissionSection(p("pinoria.world.avatar.configure")), "world");
  assert.equal(avatarPermissionSection(p("pinoria.wish_event.invalidate")), "wish");
  for (const key of ["pinoria.world.manage", "pinoria.world.instance.grant", "pinoria.world.avatar.delete", "pinoria.wish.draw", "pinoria.wish.view", "pinoria.wish.config.manage", "pinoria.wish.config.view", "pinoria.world.avatar.manage", "pinoria.self.item.manage.extra"]) assert.equal(avatarPermissionSection(p(key)), null);
  assert.equal(avatarPermissionSection(p("pinoria.world.avatar.view", "other")), null);
});
test("only supplied catalog rows are grouped, in stable sections without new identities", () => {
  const rows = Object.freeze([p("pinoria.wish_event.view"), p("pinoria.self.create"), p("pinoria.world.avatar.view"), p("pinoria.world.view"), p("pinoria.self.nickname.manage")]);
  const groups = avatarPermissionPresentation(rows);
  assert.deepEqual(groups.map(g => g.section), ["profile", "world", "wish", null]);
  const flattened = groups.flatMap(g => g.items);
  assert.equal(flattened.length, rows.length);
  assert.ok(rows.every(row => flattened.includes(row)));
  assert.deepEqual(rows.map(row => row.key), ["pinoria.wish_event.view", "pinoria.self.create", "pinoria.world.avatar.view", "pinoria.world.view", "pinoria.self.nickname.manage"]);
});
test("empty catalog or filtered subset cannot manufacture permissions", () => {
  assert.deepEqual(avatarPermissionPresentation([]), []);
  const row = p("pinoria.wish_event.view");
  assert.deepEqual(avatarPermissionPresentation([row]), [{section:"wish", items:[row]}]);
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PermissionPresentationRows } from "../app/ho/system/roles/HoRoleEditor";
import type { BoAccessPermission } from "./bo-access-model";

function fixture(key:string, domain="pinoria"): BoAccessPermission {
  return {key,domain,displayLabel:"Synthetic "+key,description:"Local UI fixture only",accessKind:"read",
    surfaceApplicability:"BO",allowedScopes:["CENTER"],contextualPolicy:null};
}
function markup(domain:string, rows: readonly BoAccessPermission[]) {
  return renderToStaticMarkup(createElement(PermissionPresentationRows,{
    domain,permissions:rows,renderRow:permission=>createElement("span",{key:permission.key,"data-row":permission.key},permission.displayLabel)
  }));
}
test("native presentation renders each supplied row once and does not combine unrelated permissions",()=>{
  const rows=[fixture("pinoria.self.create"),fixture("pinoria.self.item.view"),fixture("pinoria.self.loadout.view"),
    fixture("pinoria.world.avatar.view"),fixture("pinoria.wish_event.view"),fixture("pinoria.wish.draw")];
  const html=markup("pinoria",rows);
  for(const row of rows)assert.equal(html.split('data-row="'+row.key+'"').length,2);
  for(const label of ["Avatar","Profile","Items","Loadout","World","Wish"])assert.ok(html.includes('aria-label="'+label+'"'));
  assert.ok(html.indexOf('data-row="pinoria.wish.draw"')>html.indexOf("</section>"));
});
test("filtered and non-Pinoria catalog presentation never manufactures rows or empty subgroups",()=>{
  const html=markup("pinoria",[fixture("pinoria.self.create")]);
  assert.match(html,/aria-label="Profile"/);
  for(const label of ["Items","Loadout","World","Wish"])assert.ok(!html.includes('aria-label="'+label+'"'));
  assert.equal(markup("pinoria",[]),"");
  assert.ok(!markup("access",[fixture("access.role.view","access")]).includes('aria-label="Avatar"'));
});
