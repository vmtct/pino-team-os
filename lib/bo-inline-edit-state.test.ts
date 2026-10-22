import assert from "node:assert/strict";
import test from "node:test";
import { emptyBoInlineEditState, stageBoInlineEdit, undoBoInlineEdit } from "./bo-inline-edit-state";
const fields = new Set(["name"]);
test("reject unapproved field and no-op", () => {
  assert.equal(stageBoInlineEdit(emptyBoInlineEditState, {rowKey:"1",field:"salary",before:2,after:3},fields), emptyBoInlineEditState);
  assert.equal(stageBoInlineEdit(emptyBoInlineEditState, {rowKey:"1",field:"name",before:"A",after:"A"},fields), emptyBoInlineEditState);
});
test("stage and undo local draft without invoking persistence", () => {
  const one = stageBoInlineEdit(emptyBoInlineEditState,{rowKey:"1",field:"name",before:"A",after:"B"},fields);
  assert.deepEqual(one.pending,[{rowKey:"1",field:"name",before:"A",after:"B"}]);
  const two = stageBoInlineEdit(one,{rowKey:"1",field:"name",before:"B",after:"C"},fields);
  assert.deepEqual(two.pending,[{rowKey:"1",field:"name",before:"A",after:"C"}]);
  const undo = undoBoInlineEdit(two);
  assert.deepEqual(undo.pending,[{rowKey:"1",field:"name",before:"A",after:"B"}]);
  assert.deepEqual(undoBoInlineEdit(undo).pending,[]);
});