/** PAP-1936 · TeamOS shared nav source contract, no auth or live writes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import postcss from "postcss";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const phone=read("app/components/tos-ds/AppPhoneFrame.tsx");
const nav=read("app/components/tos-ds/Primitives.tsx");
const controller=read("app/components/tos-ds/ScrollAwareChrome.tsx");
const tokens=read("app/components/tos-ds/tokens.css");
const primitiveCss=read("app/components/tos-ds/primitives.module.css");
const frameCss=read("app/components/tos-ds/phone-frame.module.css");
const shell=read("app/components/tos-shell/TosShell.tsx");
const shellCss=read("app/components/tos-shell/tos-shell.module.css");

test("PAP-1936 TSX compiles syntactically with supported React JSX",()=>{
 for(const [file,source] of Object.entries({AppPhoneFrame:phone,Primitives:nav,ScrollAwareChrome:controller,TosShell:shell})){
  const r=ts.transpileModule(source,{fileName:file+".tsx",reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  assert.equal(r.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,file);
 }
});
test("PAP-1936 both shell CSS and TOS DS CSS parse",()=>{
 for(const css of [tokens,primitiveCss,frameCss,shellCss])assert.doesNotThrow(()=>postcss.parse(css));
});
test("PAP-1936 nav text-only without icon DOM, semantics retained",()=>{
 const block=nav.slice(nav.indexOf("export function AppBottomNav"),nav.indexOf("export function AppSectionHeading"));
 assert.ok(!block.includes("item.icon"));assert.ok(!block.includes("ui.navIcon"));
 assert.match(block,/ui.navText/);assert.match(block,/aria-current/);assert.match(block,/aria-selected/);
 assert.match(shell,/<small>{item.label}<\/small>/);assert.ok(!shell.includes("item.icon ? <span"));
 assert.match(shell,/aria-current/);
});
test("PAP-1936 44px nav and safe-area, 44px tap target",()=>{
 assert.match(tokens,/--tos-nav-height:44px/);
 assert.match(tokens,/--tos-hit-min:44px/);
 assert.match(primitiveCss,/min-height:var\(--tos-hit-min\)/);
 assert.match(primitiveCss,/env\(safe-area-inset-bottom/);
 assert.match(shellCss,/min-height: 44px/);
 assert.match(shellCss,/safe-area-inset-bottom/);
});
test("PAP-1936 both shells reuse single scroll controller",()=>{
 assert.match(phone,/import ScrollAwareChrome/);
 assert.match(phone,/<ScrollAwareChrome\/>/);
 assert.match(shell,/import ScrollAwareChrome/);
 assert.match(shell,/<ScrollAwareChrome\/>/);
 assert.match(frameCss,/data-tos-scroll-chrome="hidden"/);
 assert.match(shellCss,/data-tos-scroll-chrome="hidden"/);
});
test("PAP-1936 controller uses nested scrolling, direction hysteresis, focus and modal guards",()=>{
 assert.match(controller,/addEventListener\("scroll",onScroll,true\)/);
 assert.match(controller,/root\.contains\(element\)/);
 assert.match(controller,/scrollHeight-element\.clientHeight/);
 assert.match(controller,/down>=18/);
 assert.match(controller,/up>=12/);
 assert.match(controller,/performance\.now\(\)<suppressUntil/);
 assert.match(controller,/MutationObserver/);
 assert.match(controller,/\[role="dialog"\]/);
 assert.match(controller,/:focus-visible/);
 assert.match(controller,/removeEventListener\("scroll",onScroll,true\)/);
 assert.match(controller,/mutation\.disconnect\(\)/);
});
test("PAP-1936 Station desktop remains unmodified by shared frame",()=>{
 const design=read("app/components/tos-ds/TosDesignSystem.tsx");
 assert.match(design,/mode.*desktop/);
 assert.match(design,/className={styles.desktop}/);
 const access=read("lib/tos-vnext-active-access.ts");
 assert.match(access,/case "station":return options\.desktop/);
});
test("PAP-1936 reduced motion and no CSS hardcoded literal colors",()=>{
 assert.match(frameCss,/prefers-reduced-motion:reduce/);
 assert.match(shellCss,/prefers-reduced-motion:reduce/);
 const addedFrame=frameCss.slice(frameCss.indexOf("PAP-1936 · shared TOS frame chrome"));
 assert.doesNotMatch(addedFrame,/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i);
});
