import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=(name:string)=>readFileSync("app/components/tos-ds/"+name,"utf8");
test("PAP-934 V4 shared mobile/header/navigation dimensions are token-owned",()=>{
 const tokens=read("tokens.css");
 for(const [name,value] of [["mobile-max","430px"],["header-height","60px"],["nav-height","76px"],["hit-min","44px"],["control-height","48px"]])assert.ok(tokens.includes(`--tos-${name}:${value}`));
 assert.match(read("phone-frame.module.css"),/max-width:var\(--tos-mobile-max\)/);
 assert.match(read("primitives.module.css"),/min-height:var\(--tos-hit-min\)/);
 assert.match(read("system.css"),/min-height:var\(--tos-control-height\)/);
});
test("PAP-934 V4 Station remains uncapped and excludes the phone frame",()=>{
 assert.match(read("components.module.css"),/\.desktop\{[^}]*max-width:none/);
 const source=read("TosDesignSystem.tsx");
 assert.ok(source.indexOf('==="desktop")return')<source.indexOf("<AppPhoneFrame"));
});

test("PAP-938 unlayered legacy h1/h2 styles do not override layered TOS DS headings",()=>{
 const css=readFileSync("app/globals.css","utf8");
 assert.match(css,/h1:not\(:where\(\[data-tos-system\] h1\)\)\s*\{/);
 assert.match(css,/h2:not\(:where\(\[data-tos-system\] h2\)\)\s*\{/);
 assert.doesNotMatch(css,/^h[12]\s*\{/m,"Unscoped unlayered headings override all TOS DS @layer declarations");
 const home=readFileSync("app/components/tos-vnext/home.module.css","utf8");
 assert.match(home,/\.header h1\s*\{[^}]*font-size:\s*var\(--tos-home-title-size\)/);
 const tokens=read("tokens.css");
 assert.match(tokens,/--tos-home-title-size:\s*clamp\(21px,\s*5vw,\s*27px\)/);
});
