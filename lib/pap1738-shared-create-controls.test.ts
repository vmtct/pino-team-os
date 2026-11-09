// PAP-1738 / Epic PAP-1705 · PNR-AVATAR-CRUD · shared DSA CREATE control seam.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import { parentDefinition, parentSchema } from "../app/bo/parents/schema";
import { toLegacyModule } from "./workspace-schema";
import type { BoRecord } from "./bo-registration";

const fields = toLegacyModule(parentSchema as unknown as Parameters<typeof toLegacyModule>[0]).fields;
const sections = parentDefinition.drawer.sections;
const draft: BoRecord = { id:"", name:"", maskedContact:null, studentCount:0, centers:"PINO Cần Thơ", updatedAt:null, attention:null };
function render(createFields?: Record<string, {id:string; value:string; onChange:(value:string)=>void; required?:boolean; control?:import("react").ReactNode}>) {
  return renderToStaticMarkup(createElement(PropertySections, { variant:"drawer", fields, record:draft, sections, ...(createFields ? {createFields} : {}) }));
}
test("PAP-1738 complex Create field uses same shared typed row as View and keeps label association", () => {
  const view = render();
  const create = render({
    name:{id:"avatar-person",value:"",onChange:()=>{},required:true, control:createElement("div", {className:"person-picker"}, createElement("input",{id:"avatar-person",role:"combobox","aria-expanded":false,"aria-controls":"avatar-options"}))},
    maskedContact:{id:"plain-contact",value:"",onChange:()=>{}}
  });
  assert.match(create, /data-tdd-custom-create-control=""/);
  assert.match(create, /data-tdd-field="name"/);
  assert.match(view, /data-tdd-field="name"/);
  assert.match(create, /<label[^>]+for="avatar-person"/);
  assert.match(create, /role="combobox"/);
  assert.match(create, /aria-controls="avatar-options"/);
  assert.equal((create.match(/class="property-row"/g)||[]).length, (view.match(/class="property-row"/g)||[]).length);
  assert.equal((create.match(/role="combobox"/g)||[]).length,1);
  assert.match(create, /id="plain-contact"/);
  assert.doesNotMatch(view,/data-tdd-custom-create-control/);
  assert.doesNotMatch(create, /<section[^>]+class="custom/);
});
