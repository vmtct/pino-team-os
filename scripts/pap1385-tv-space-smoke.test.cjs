/* PAP-1385 / PNR-TV — stage FE candidate SSR contract smoke; no route, API, network or persistence. */
const assert = require("node:assert/strict");
const {test} = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const React = require("react");
const {renderToStaticMarkup} = require("react-dom/server");
const {buildSync} = require("esbuild");
const root=path.resolve(__dirname,"..");
const component=path.join(root,"app","ho","pinoria","tv-policies","components","HoTvSpaceMeshDraft.tsx");
const dsArchive=path.join(root,"vendor","pino-design-system","pino-design-system-0.4.0.tgz");
test("PAP-1385 imported FE Mesh draft matches pinned full-scope prototype without exposing Core writes",()=>{
 assert(fs.existsSync(component));
 assert(fs.existsSync(dsArchive));
 assert.match(fs.readFileSync(component,"utf8"),/SpatialEditorFrame/);
 assert.match(fs.readFileSync(component,"utf8"),/SpatialVertexHandle/);
 assert.doesNotMatch(fs.readFileSync(component,"utf8"),/\.\/HoTvSpaceMeshDraft\.css/);
 const source=fs.readFileSync(component,"utf8");
 assert.match(source,/FSG0_SPACE_DELTA_APPROVED/);
 assert.doesNotMatch(source,/fetch\s*\(|localStorage\s*\.setItem|sessionStorage\s*\.setItem|POST|mutation\s*\(/);
 const compiled=buildSync({
  entryPoints:[component],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",
  tsconfig:path.join(root,"tsconfig.json"),loader:{".css":"empty"},logLevel:"silent"
 });
 const fakefile=path.join(root,"scripts","pap1385-test-bundle.cjs");
 const mod=new Module(fakefile,module);mod.filename=fakefile;mod.paths=Module._nodeModulePaths(root);
 mod._compile(compiled.outputFiles[0].text,fakefile);
 assert.equal(typeof mod.exports.HoTvSpaceMeshDraft,"function");
 const html=renderToStaticMarkup(React.createElement(mod.exports.HoTvSpaceMeshDraft,{record:{scope:"DEFAULT"}}));
 assert.match(html,/data-house-mesh-northstar/);
 assert.match(html,/data-pds-spatial-editor/);
 assert.match(html,/Chú thích chức năng/);
 assert.match(html,/Khu vực hiện hữu/);
 assert.match(html,/Điểm xuất hiện/);
 assert.match(html,/Chọn đối tượng House Mesh/);
 assert.match(html,/Lanes/);
 assert.match(html,/Connectors/);
 assert.match(html,/4<\/strong>/);
 assert.match(html,/8<\/strong>/);
 assert.match(html,/12<\/strong>/);
 assert.match(html,/0<\/strong>/);
 assert.equal((html.match(/value="lane:lane-/g)||[]).length,8);
 assert.equal((html.match(/value="connector:connector-/g)||[]).length,12);
 assert.equal((html.match(/class="house-area-existing/g)||[]).length,1);
 assert.equal((html.match(/class="house-function-guide/g)||[]).length,1);
 assert.doesNotMatch(html,/Publish now|Save to Core|Live Presence/);
});
