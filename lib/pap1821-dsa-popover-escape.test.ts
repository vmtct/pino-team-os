/** PAP-1821 / Epic PAP-1665 PLT-ATTR — one Escape belongs to the editor, then Drawer. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editorOwnsDialogKey, handleDialogKey } from "../app/components/workspace-renderer/dialog";

const selector = ".edit-popover:not(.hidden)";
function press(owned: boolean, calls: string[]) {
  const key = { key: "Escape", shiftKey: false, preventDefault: () => calls.push("prevent") };
  handleDialogKey(key, {
    editorOpen: owned, containsActive: false, active: null,
    close: () => calls.push("drawer-close")
  });
}
test("PAP-1821: original editor event path still owns Escape after React unmounts popover", () => {
  const oldPopover = { matches: (value: string) => value === selector };
  const detachedControl = { closest: () => null };
  const key = { target: detachedControl, composedPath: () => [detachedControl, oldPopover] };
  const calls: string[] = [];
  assert.equal(editorOwnsDialogKey(key as unknown as KeyboardEvent), true);
  press(editorOwnsDialogKey(key as unknown as KeyboardEvent), calls);
  assert.deepEqual(calls, [], "first Escape must not close Drawer");
  // Editor has now unmounted; second distinct Escape comes from the Drawer.
  const second = { target: detachedControl, composedPath: () => [detachedControl] };
  assert.equal(editorOwnsDialogKey(second as unknown as KeyboardEvent), false);
  press(editorOwnsDialogKey(second as unknown as KeyboardEvent), calls);
  assert.deepEqual(calls, ["prevent", "drawer-close"]);
});
test("PAP-1821: detached input can still report its former popover via closest()", () => {
  const target = { closest: (value: string) => value === selector ? {} : null };
  assert.equal(editorOwnsDialogKey({ target, composedPath: () => [] } as unknown as KeyboardEvent), true);
  assert.equal(editorOwnsDialogKey({ target: null, composedPath: () => [] } as unknown as KeyboardEvent), false);
});
test("PAP-1821: unrelated/hidden popovers do not swallow Drawer Escape or focus trapping", () => {
  const target = { closest: () => null };
  const hidden = { matches: () => false };
  const event = { target, composedPath: () => [target, hidden] };
  assert.equal(editorOwnsDialogKey(event as unknown as KeyboardEvent), false);
  const calls: string[] = [];
  const first = { focus: () => calls.push("first") };
  handleDialogKey({ key: "Tab", shiftKey: false, preventDefault: () => calls.push("prevent") }, {
    editorOpen: false, active: null, containsActive: false, first, last: first,
    close: () => calls.push("drawer-close")
  });
  assert.deepEqual(calls, ["prevent", "first"]);
});
test("PAP-1821: original shared editor cleanup restores anchor focus (no duplicate editor)", () => {
  const root = readFileSync("app/bo/components/registration/BoTypedEditor.tsx", "utf8");
  const hook = readFileSync("app/bo/components/registration/useBoDialog.ts", "utf8");
  const drawer = readFileSync("app/bo/components/registration/BoQuickView.tsx", "utf8");
  assert.match(root, /anchor\.isConnected\) anchor\.focus\(\)/);
  assert.match(root, /id="popover" className="edit-popover"/);
  assert.match(hook, /editorOwnsDialogKey\(e\)/);
  assert.match(drawer, /<BoTypedEditor/);
  assert.match(drawer, /<DrawerFrame/);
});
