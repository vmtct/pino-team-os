// PAP-1456 / Epic PAP-1097 — scoped PINO DS center selection and loading UI regression.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PresentationState, SingleSelect } from "@pino/design-system/react";

const source = readFileSync(new URL("../app/bo/pinoria-avatars/SelfDirectoryTdd.tsx", import.meta.url), "utf8");

test("Self Directory uses approved PINO DS SingleSelect with explicit center admission", () => {
  assert.match(source, /import \{ PresentationState, SingleSelect \} from "@pino\/design-system\/react"/);
  assert.match(source, /<SingleSelect id="self-directory-center" label="Cơ sở" value=\{selected\}/);
  assert.match(source, /onChange=\{setSelected\} describedBy="pinoria-self-center-help" required/);
  assert.match(source, /options=\{centers\.map\(center=>\(\{value:center\.id,label:center\.displayName\}\)\)\}/);
  assert.doesNotMatch(source, /<select id="self-directory-center"/);
  assert.match(source, /loadAuthorizedDirectoryCenters\(fetch,ctl\.signal\)/);
  assert.match(source, /createBoTddAdapter\(/);
});

test("Shared DS renders accessible center select and loading state", () => {
  const select = renderToStaticMarkup(SingleSelect({
    id: "self-directory-center", label: "Cơ sở", value: "",
    options: [{ value: "center-1", label: "Cần Thơ" }],
    onChange: () => undefined,
    describedBy: "pinoria-self-center-help",
    required: true,
  }));
  assert.match(select, /data-pds-component="single-select"/);
  assert.match(select, /class="pds-property-input"/);
  assert.match(select, /aria-label="Cơ sở"/);
  assert.match(select, /aria-describedby="pinoria-self-center-help"/);
  assert.match(select, /<option value="center-1">Cần Thơ<\/option>/);
  const loading = renderToStaticMarkup(PresentationState({ state: "loading" }));
  assert.match(loading, /data-pds-state="loading"/);
  assert.match(loading, /role="status"/);
});

test("Permission separation and typed Self Loadout extension are retained", () => {
  assert.match(source, /context\.authorize\("pinoria\.self\.loadout\.view"\)/);
  assert.match(source, /context\.authorize\("pinoria\.self\.loadout\.manage"\)/);
  assert.match(source, /activeTab === "loadout"/);
  assert.match(source, /aria-busy=\{Boolean\(selected && !ready && !error\)\}/);
});
