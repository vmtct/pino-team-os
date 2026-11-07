import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "../app/bo/components/registration/BoRegistrationWorkspace";
import { BoApplicationShellContext } from "../app/bo/shell/BoApplicationShellContext";

const source: BoWorkspaceSource = {
  modules: { students: { label: "Students", group: "SCHOOL", fields: [] } },
  scopeLabel: () => "",
  load: async () => { throw Error("No business read in composition test"); },
};
const user = { displayName: "Synthetic user" };
const content = () => h("section", { id: "retained-content" }, "Retained business content");
const count = (html: string, attribute: string) => html.split(attribute).length - 1;

test("PAP-1598 nested BO workspaces retain content with one navigation and mobile trigger", () => {
  const nested = h(BoRegistrationWorkspace, { source, currentUser: user, content: content() });
  const html = renderToStaticMarkup(h(BoRegistrationWorkspace, { source, currentUser: user, shellOnly: true, content: nested }));
  for (const id of ["app", "sidebar", "workspace", "nav-scrim", "retained-content"])
    assert.equal(count(html, `id="${id}"`), 1, id);
  assert.equal(count(html, 'aria-label="Mở menu"'), 1);
  assert.match(html, /Retained business content/);
});

test("PAP-1598 content-only BO routes receive canonical navigation and a mobile trigger", () => {
  const html = renderToStaticMarkup(h(BoRegistrationWorkspace, { source, currentUser: user, shellOnly: true, content: content() }));
  assert.equal(count(html, 'id="sidebar"'), 1);
  assert.equal(count(html, 'id="bo-application-menu-btn"'), 1);
  assert.equal(count(html, 'id="retained-content"'), 1);
});

test("PAP-1598 inherited BO chrome never removes the separate HO shell", () => {
  const html = renderToStaticMarkup(h(BoApplicationShellContext.Provider, { value: () => null },
    h(BoRegistrationWorkspace, { source: { ...source, surface: "ho" }, currentUser: user, content: content() })));
  assert.equal(count(html, 'id="sidebar"'), 1);
  assert.match(html, /data-surface="ho"/);
  assert.equal(count(html, 'id="retained-content"'), 1);
});
