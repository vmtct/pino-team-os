/** PAP-1986 / PAP-1665 PLT-ATTR: preserve editor Escape ownership in HO Full Detail. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editorOwnsDialogKey } from "../app/components/workspace-renderer/dialog";

test("PAP-1986: Full Detail uses the shared original-event editor ownership guard before navigating back", () => {
  const source = readFileSync("app/ho/system/custom-attributes/HoAttributeFullDetail.tsx", "utf8");
  assert.match(source, /import\s*\{\s*editorOwnsDialogKey\s*\}\s*from\s*"@\/app\/components\/workspace-renderer\/dialog"/);
  const handler = source.slice(source.indexOf("const escape=(event:KeyboardEvent)"), source.indexOf('document.addEventListener("keydown",escape)'));
  assert.match(handler, /event\.key!==["']Escape["']\|\|event\.defaultPrevented\|\|event\.repeat/);
  const guard = handler.indexOf("editorOwnsDialogKey(event)");
  const back = handler.indexOf("onBack()");
  assert.ok(guard >= 0 && back > guard);
  assert.match(handler, /if\(editorOwnsDialogKey\(event\)\|\|document\.querySelector\('\.edit-popover:not\(\.hidden\)'\)\)return;/);
});
test("PAP-1986: the detached original input still owns the first Escape, not a subsequent Detail Escape", () => {
  const oldPopover = { matches: (selector: string) => selector === ".edit-popover:not(.hidden)" };
  const detached = { closest: () => null };
  const editorEvent = { target: detached, composedPath: () => [detached, oldPopover] } as unknown as KeyboardEvent;
  const detailEvent = { target: detached, composedPath: () => [detached] } as unknown as KeyboardEvent;
  assert.equal(editorOwnsDialogKey(editorEvent), true);
  assert.equal(editorOwnsDialogKey(detailEvent), false);
});
