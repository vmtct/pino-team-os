import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { BO_AUTHORITY_ASSETS } from "./bo-skeleton";
test("React presentation uses only classes defined by Hồ sơ đăng ký; no per-module CSS", () => {
  const css = [...BO_AUTHORITY_ASSETS].map(f => readFileSync("public/bo-authority-source/" + f, "utf8")).join("\n");
  const classes = new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(m => m[1]));
  const folder = "app/bo/components/registration/";
  for (const file of readdirSync(folder)) {
    assert.ok(!file.endsWith(".css"), file);
    if (!file.endsWith(".tsx")) continue;
    const text = readFileSync(folder + file, "utf8"), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(tree) === "className" && node.initializer && ts.isStringLiteral(node.initializer)) {
        for (const name of node.initializer.text.split(/\s+/).filter(Boolean)) assert.ok(classes.has(name) || (file === "BoRegistrationWorkspace.tsx" && ["brand", "brand-type", "ho-brand-logo"].includes(name)), file + " introduced class " + name);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.doesNotMatch(text, /(?:color|background|fontSize|padding|margin|borderRadius)\s*:/, file + " contains authored visual styling");
  }
});
test("legacy styling keeps its exact build mapping and is not imported into the new root", () => {
  const build = readFileSync("scripts/build-bo-public-views.mjs", "utf8"), root = readFileSync("app/layout.tsx", "utf8");
  assert.match(build, /copyFile\('app\/globals\.css','public\/team-legacy-global\.css'\)/);
  assert.match(build, /copyFile\('app\/bo\/design-system\/foundation\.css','public\/bo-legacy-foundation\.css'\)/);
  assert.doesNotMatch(root, /import\s+["']\.\/globals\.css["']/);
  assert.match(root, /boSkeletonEnabled\(env/);
});
