/* PAP-1604/PAP-1605/PAP-1606 · Epic PAP-1601 · React provider list-title contract. */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PinoNavLocaleContext, LocalizedModuleTitle } from "./pino-nav-locale-context";

test("React list headings follow current BO locale without mutating source schema label", () => {
  const title = "Running Classes";
  const titleNode = createElement("h1", null, createElement(LocalizedModuleTitle, { label: title, moduleKey: "classes" }));
  const vi = renderToStaticMarkup(createElement(PinoNavLocaleContext.Provider, { value: { surface: "bo", language: "vi" } }, titleNode));
  const en = renderToStaticMarkup(createElement(PinoNavLocaleContext.Provider, { value: { surface: "bo", language: "en" } }, titleNode));
  assert.equal(vi, "<h1>Ca học</h1>");
  assert.equal(en, "<h1>Running Class</h1>");
  assert.equal(title, "Running Classes");
});
test("HO technical route heading localizes without editing translation rows", () => {
  const heading = createElement(LocalizedModuleTitle, { label: "Language Mapping", moduleKey: "languageMappings" });
  assert.equal(renderToStaticMarkup(createElement(PinoNavLocaleContext.Provider, { value: { surface: "ho", language: "vi" } }, heading)), "Đối chiếu ngôn ngữ");
  assert.equal(renderToStaticMarkup(createElement(PinoNavLocaleContext.Provider, { value: { surface: "ho", language: "en" } }, heading)), "Language Mapping");
});
