/** PAP-1071: changed-route G0/G1. No runtime permissions or migration admission inferred. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import postcss from 'postcss';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = '9b23fd417f0251bce0245882b5152b2cf2ca0920';
export const MANIFEST = 'config/tdd-admission.json';
const surfaceFile = /^app\/(bo|ho)\//;
const routeFile = /^app\/(bo|ho)\/(?:.*\/)?page\.(?:tsx?|jsx?)$/;
const sourceFile = /\.(?:tsx?|jsx?|css)$/;
const canonical = /^(?:app\/components\/(?:workspace-renderer|workspace-adapters)\/|lib\/workspace-schema\/)/;
// PAP-1105 shared Table primitive, compiled by both hash-checked DS generators.
// This exact source is shared-owner work, never a module admission or migration.
const sharedExtensions = new Set(['app/components/workspace-renderer/tdd-freeze.css']);
const shellClass = /(?:^|\s)(?:detail-(?:cover|hero|nav|body|page|tabs)|drawer-(?:footer|header|body|overlay)|v24-prop-grid|table-wrap|data-table)(?:\s|$)/;
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio:['ignore','pipe','pipe'] }).trim();
const list = (root, dir) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), {withFileTypes:true}).flatMap(e => e.isDirectory() ? list(root, dir+'/'+e.name) : [dir+'/'+e.name]) : [];
export const routes = root => ['app/bo','app/ho'].flatMap(d=>list(root,d)).filter(f=>routeFile.test(f)).sort();
const parse = (file, source) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
function localFile(root, from, spec) {
  const stem = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(from),spec)) : null;
  if (!stem || stem.startsWith('../')) return null;
  return [stem, ...['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(e=>stem+e)].find(f=>sourceFile.test(f)&&fs.existsSync(path.join(root,f))) ?? null;
}
/** Follow local imports/re-exports, require and literal import(); reject opaque loaders in gated code. */
export function graph(root, entry) {
  const files = new Set();
  function visit(file) {
    if(files.has(file)) return; files.add(file);
    if(file.endsWith('.css')) return;
    const ast = parse(file,read(root,file));
    function walk(n) {
      let spec;
      if ((ts.isImportDeclaration(n)||ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) spec=n.moduleSpecifier.text;
      if(ts.isCallExpression(n) && (n.expression.kind===ts.SyntaxKind.ImportKeyword || n.expression.getText(ast)==='require') && ts.isStringLiteral(n.arguments[0])) spec=n.arguments[0].text;
      if(spec) { const f=localFile(root,file,spec); if(f) visit(f); }
      ts.forEachChild(n,walk);
    } walk(ast);
  } visit(entry); return [...files].sort();
}
export function inspectModuleSource(file, source) {
  const errors=[]; const ast=parse(file,source);
  function walk(n) {
    if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)) {
      const tag=n.tagName.getText(ast);
      if(['table','dialog'].includes(tag)) errors.push('module-owned '+tag+' shell');
      for(const p of n.attributes.properties) {
        if(ts.isJsxSpreadAttribute(p)) errors.push('opaque JSX spread (use typed shared component props)');
        if(!ts.isJsxAttribute(p)) continue;
        const name=p.name.getText(ast);
        if(name==='style') errors.push('module-owned inline CSS');
        if(name==='dangerouslySetInnerHTML') errors.push('opaque HTML shell');
        if(name==='className') {
          let v=p.initializer;
          if(v&&ts.isJsxExpression(v)) v=v.expression;
          if(!v || !(ts.isStringLiteral(v)||ts.isNoSubstitutionTemplateLiteral(v))) errors.push('opaque className');
          else if(shellClass.test(v.text)) errors.push('reserved shell class');
        }
        if(name==='role' && p.initializer && ts.isStringLiteral(p.initializer) && ['dialog','tablist','tabpanel','grid'].includes(p.initializer.text)) errors.push('module-owned shell role');
      }
    }
    if(ts.isCallExpression(n)) {
      const name=n.expression.getText(ast);
      if(/(?:createElement|\.innerHTML|insertAdjacentHTML)$/.test(name)) errors.push('opaque programmatic shell');
      if((n.expression.kind===ts.SyntaxKind.ImportKeyword||name==='require') && (!n.arguments[0]||!ts.isStringLiteral(n.arguments[0]))) errors.push('opaque import');
    }
    if(ts.isBinaryExpression(n)&&/\.(?:innerHTML|outerHTML)$/.test(n.left.getText(ast))) errors.push('opaque HTML assignment');
    ts.forEachChild(n,walk);
  } walk(ast); return [...new Set(errors)].map(e=>file+': '+e);
}
export function inspectForeignCss(file,before,after) {
  const collect=css=>{const rules=[];postcss.parse(css).walkRules(r=>rules.push(r.toString()));return new Set(rules);};
  const old=collect(before),errors=[];
  postcss.parse(after).walkRules(r=>{if(!old.has(r.toString()) && /(?:detail-(?:hero|cover|body|nav)|drawer-(?:footer|header|body|overlay)|data-bo-ui-authority|data-surface[=\s\"']+ho)/.test(r.selector)) errors.push(file+': shell CSS outside surface authority');});
  return errors;
}
export function inspectCss(file, css, surface) {
  const errors=[];
  try { postcss.parse(css).walkRules(rule=>{
    if(rule.parent?.type==='atrule' && /keyframes$/.test(rule.parent.name)) return;
    for(const s of rule.selectors) {
      // Accept the generators' root-token/HTML forms and HO theme root as well
      // as their ordinary descendant scope. Cross-surface selectors still fail.
      const scope=surface==='BO'
        ? /(?:html\[data-bo-ui-authority=["']v25["']\]|(?:html|:root):where\(\[data-bo-ui-authority=["']v25["']\]\))/
        : /(?:html\[data-surface=["']ho["']\]|(?:html|:root):where\(\[data-surface=["']ho["']\]\)|^\[data-surface=["']ho["']\])/;
      if(!scope.test(s)|| (surface==='BO' ? /data-surface=["']ho/.test(s) : /data-bo-ui-authority/.test(s))) errors.push(file+': cross-surface or unscoped CSS');
    }
  }); } catch {errors.push(file+': invalid CSS');}
  return [...new Set(errors)];
}
function exactFile(f) { return typeof f==='string' && /^[A-Za-z0-9_./-]+$/.test(f) && !f.startsWith('/') && !f.split('/').some(s=>s==='..'||s==='.') && !f.includes('//'); }
function exactRoute(r,surface) {return ['BO','HO'].includes(surface) && typeof r==='string' && r.startsWith('/'+surface.toLowerCase()+'/') && /^\/[a-z0-9/-]+$/.test(r) && !r.includes('//') && !r.endsWith('/');}
export function validateSpecial(entry, approvals, changed, now) {
  if(approvals.filter(a=>a.id===entry.approval).length!==1) return ['missing/ambiguous Founder approval'];
  const a=approvals.find(a=>a.id===entry.approval);
  const errors=[];
  if(!a||a.status!=='approved'||a.approvedBy!=='Founder'||!/^https:\/\/vmtct97\.atlassian\.net\/browse\/PAP-\d+\?focusedCommentId=\d+$/.test(a?.reference??'')) return ['unverified Founder approval'];
  if(!exactRoute(a.route,a.surface)||a.route!==entry.route||a.surface!==entry.surface||a.key!==entry.key) errors.push('approval route/surface/key mismatch');
  if(![a.owner,a.justification,a.designAuthority,a.fallback].every(v=>typeof v==='string'&&v.trim())||!Array.isArray(a.permissions)||!a.permissions.length||!a.permissions.every(v=>typeof v==='string'&&v.trim())) errors.push('incomplete special profile');
  const from=Date.parse(a.approvedAt), to=Date.parse(a.expiresAt);
  if(typeof a.approvedAt!=='string'||typeof a.expiresAt!=='string'||!Number.isFinite(from)||from>now||!Number.isFinite(to)||to<=now||to<=from) errors.push('expired/future approval');
  if(!Array.isArray(a.files)||!a.files.length||!a.files.every(exactFile)||new Set(a.files).size!==a.files.length||JSON.stringify([...a.files].sort())!==JSON.stringify([...entry.files].sort())) errors.push('approval file fence mismatch');
  if(changed.some(f=>entry.files.includes(f)&&!a.files.includes(f))) errors.push('out-of-scope exception');
  for(const key of ['security','authorization','accessibility','responsive']) if(!Array.isArray(a.tests?.[key])||!a.tests[key].length||!a.tests[key].every(exactFile)) errors.push('missing '+key+' tests');
  return errors;
}
export async function verify(root=ROOT,{changed=[],baseline,manifest,now=Date.now(),loadSchema,approvals=[]}={}) {
  baseline??=JSON.parse(read(root,'config/tdd-inventory.json'));
  manifest??=JSON.parse(read(root,MANIFEST));
  const errors=[],reports=[],tests=new Set();
  const entries=manifest.modules??[], known=new Map(baseline.routes.map(e=>[e.file,e]));
  const seen=new Set();
  for(const e of entries) {
    if(!['BO','HO'].includes(e.surface)||!exactRoute(e.route,e.surface)||!routeFile.test(e.file)||('/'+e.file.slice(4).replace(/\/page\.(?:tsx?|jsx?)$/,''))!==e.route||seen.has(e.file)) {errors.push('invalid/duplicate admission route');continue;} seen.add(e.file);
    if(!['TDD_DEFAULT','FOUNDER_APPROVED_SPECIAL','EXISTING_GRANDFATHERED'].includes(e.profile)) {errors.push(e.file+': invalid profile');continue;}
    if(!Array.isArray(e.files)||!e.files.includes(e.file)||!e.files.every(exactFile)) {errors.push(e.file+': invalid file fence');continue;}
    if(e.profile==='EXISTING_GRANDFATHERED') {
      if(!known.has(e.file)) errors.push(e.file+': new route cannot self-grandfather');
      reports.push(e.file+': inventory only; baseline auth/security CI retained'); continue;
    }
    const dependencies=graph(root,e.file);
    if(e.profile==='TDD_DEFAULT' && e.files.some(f=>canonical.test(f))) errors.push(e.file+': module cannot claim shared authority files');
    const impacted=changed.includes(MANIFEST)||changed.some(f=>e.files.includes(f)||dependencies.includes(f)||canonical.test(f)||/^(?:public\/(?:bo|ho)-authority-source\/|scripts\/build-(?:bo|ho)-authority|app\/ho\/ho-theme\.css|app\/globals\.css)/.test(f));
    if(!impacted) continue;
    for(const f of e.files) if(!fs.existsSync(path.join(root,f))) errors.push(e.file+': missing owned file '+f);
    for(const f of dependencies.filter(f=>!canonical.test(f))) if(!e.files.includes(f)) errors.push(e.file+': dependency outside admission fence '+f);
    if(e.profile==='FOUNDER_APPROVED_SPECIAL') {
      errors.push(...validateSpecial(e,approvals,changed,now).map(s=>e.file+': '+s));
      const a=approvals.find(a=>a.id===e.approval);
      for(const f of Object.values(a?.tests??{}).flat()) tests.add(f);
      for(const f of e.files.filter(f=>f.endsWith('.css'))) errors.push(...inspectCss(f,read(root,f),e.surface));
      continue;
    }
    if(!e.schema||!exactFile(e.schema.file)||!e.files.includes(e.schema.file)||!dependencies.includes(e.schema.file)||!e.schema.export) errors.push(e.file+': connected typed schema registration required');
    else {
      const src=parse(e.schema.file,read(root,e.schema.file)); let registered=false;
      const constructors=new Set(),registries=new Set();
      for(const st of src.statements) if(ts.isImportDeclaration(st)&&ts.isStringLiteral(st.moduleSpecifier)&&['lib/workspace-schema/index.ts','lib/workspace-schema/registry.ts'].includes(localFile(root,e.schema.file,st.moduleSpecifier.text))) {
        for(const n of st.importClause?.namedBindings?.elements??[]) if((n.propertyName?.text??n.name.text)==='TddRegistry') constructors.add(n.name.text);
      }
      function instances(n) {if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isNewExpression(n.initializer)&&constructors.has(n.initializer.expression.getText(src))) registries.add(n.name.text);ts.forEachChild(n,instances);} instances(src);
      function scan(n) { if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='register'&&registries.has(n.expression.expression.getText(src))) registered=true; ts.forEachChild(n,scan); } scan(src);
      if(!registered) errors.push(e.file+': TddRegistry.register required');
      const bindingFile=e.binding?.file;
      let connected=false;
      if(bindingFile && e.files.includes(bindingFile) && dependencies.includes(bindingFile)) {
        const bindingAst=parse(bindingFile,read(root,bindingFile));
        const imports=new Map();
        for(const st of bindingAst.statements) if(ts.isImportDeclaration(st)&&ts.isStringLiteral(st.moduleSpecifier)) {
          const target=localFile(root,bindingFile,st.moduleSpecifier.text);
          for(const n of st.importClause?.namedBindings?.elements??[]) imports.set(n.name.text,{target,original:n.propertyName?.text??n.name.text});
        }
        function bind(n) {
          if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)) {
            const imp=imports.get(n.tagName.getText(bindingAst));
            if(imp?.original==='TddRenderer' && imp.target==='app/components/workspace-renderer/Renderer.tsx') {
              const identifiers=[]; function ids(x) {if(ts.isIdentifier(x)) identifiers.push(x.text);ts.forEachChild(x,ids);} for(const attr of n.attributes.properties) if(ts.isJsxAttribute(attr)&&attr.name.getText(bindingAst)==='view') ids(attr);
              connected=identifiers.some(id=>imports.get(id)?.target===e.schema.file && imports.get(id)?.original===e.schema.export);
            }
          } ts.forEachChild(n,bind);
        } bind(bindingAst);
      }
      if(!connected) errors.push(e.file+': explicit imported schema at canonical renderer binding required');
      try {
        const schema=loadSchema ? await loadSchema(e) : (await import(pathToFileURL(path.join(root,e.schema.file)).href))[e.schema.export];
        const {validateModule}=await import(pathToFileURL(path.join(ROOT,'lib/workspace-schema/validate.ts')).href);
        validateModule(schema);
        if(schema.surface!==e.surface||schema.key!==e.key) errors.push(e.file+': schema identity mismatch');
      } catch(error) {errors.push(e.file+': '+error.message);}
    }
    if(!dependencies.includes('app/components/workspace-renderer/Renderer.tsx')&&!dependencies.includes('app/components/workspace-adapters/SurfaceWorkspace.tsx')) errors.push(e.file+': shared renderer required');
    for(const f of e.files.filter(f=>sourceFile.test(f)&&!canonical.test(f)&&!f.includes('.test.'))) {
      if(f.endsWith('.css')) errors.push(f+': module CSS is not DS authority');
      else errors.push(...inspectModuleSource(f,read(root,f)));
    }
    for(const f of e.tests??[]) tests.add(f);
    if(!e.tests?.length) errors.push(e.file+': regression test required');
    reports.push(e.file+': TDD_DEFAULT G0/G1');
  }
  for(const f of routes(root)) if(!known.has(f)&&!seen.has(f)) errors.push(f+': new BO/HO route requires explicit TDD admission');
  for(const f of changed) {
    if(surfaceFile.test(f)&&f.endsWith('.css')&&!(baseline.sourceFiles??[]).includes(f)&&!['app/ho/ho-theme.css'].includes(f)&&!entries.some(e=>e.files.includes(f)&&e.profile==='FOUNDER_APPROVED_SPECIAL')) errors.push(f+': unauthorized surface stylesheet');
    if(/^public\/(bo|ho)-authority-source\/(bo|ho)-scoped\.css$/.test(f)&&fs.existsSync(path.join(root,f))) errors.push(...inspectCss(f,read(root,f),f.includes('/bo-')?'BO':'HO'));
  }
  for(const f of changed.filter(f=>canonical.test(f))) {
    if(!(baseline.sourceFiles??[]).includes(f)&&!sharedExtensions.has(f)) errors.push(f+': new shared authority file requires separate owner reconciliation');
  }
  for(const f of tests) if(!exactFile(f)||! /\.test\.(?:tsx?|mjs)$/.test(f)||!fs.existsSync(path.join(root,f))) errors.push('missing/invalid profile test '+f);
  return {errors:[...new Set(errors)],reports,tests:[...tests].sort(),inventoryPending:baseline.routes.length};
}
export async function main() {
  const baseIndex=process.argv.indexOf('--base');
  const base=baseIndex<0?(process.env.TDD_BASE||'origin/main'):process.argv[baseIndex+1];
  const changed=git(ROOT,['diff','--name-only',base,'HEAD']).split(/\r?\n/).filter(Boolean);
  const baseline=JSON.parse(read(ROOT,'config/tdd-inventory.json'));
  const original=git(ROOT,['ls-tree','-r','--name-only',BASELINE]).split(/\r?\n/);
  const originalRoutes=original.filter(f=>routeFile.test(f)).sort();
  if(baseline.sourceSha!==BASELINE || JSON.stringify(baseline.routes.map(r=>r.file).sort())!==JSON.stringify(originalRoutes) || baseline.sourceFiles.some(f=>!original.includes(f))) throw Error('grandfather inventory must match immutable source baseline');
  // Only already-merged approval records may authorize a special route. Candidate declarations are requests.
  let approvals=[];
  if(git(ROOT,['ls-tree','--name-only',base,'config/tdd-approved-special.json'])) approvals=JSON.parse(git(ROOT,['show',base+':config/tdd-approved-special.json'])).approvals;
  let previous=[];
  if(git(ROOT,['ls-tree','--name-only',base,MANIFEST])) previous=JSON.parse(git(ROOT,['show',base+':'+MANIFEST])).modules;
  const current=JSON.parse(read(ROOT,MANIFEST));
  for(const e of previous.filter(e=>e.profile!=='EXISTING_GRANDFATHERED')) if(!current.modules.some(n=>n.file===e.file&&n.profile===e.profile)) throw Error('admitted route cannot return to grandfathered inventory: '+e.file);
  const result=await verify(ROOT,{changed,baseline,approvals});
  for(const f of changed.filter(f=>f.endsWith('.css')&&!/^(?:public\/(?:bo|ho)-authority-source\/|app\/ho\/ho-theme\.css)/.test(f))) {
    if(!fs.existsSync(path.join(ROOT,f))) continue;
    let before=''; try {before=git(ROOT,['show',base+':'+f]);} catch {}
    result.errors.push(...inspectForeignCss(f,before,read(ROOT,f)));
  }
  console.log(JSON.stringify(result,null,2));
  if(result.errors.length) return 1;
  if(result.tests.length) execFileSync(process.execPath,['--import','tsx','--test',...result.tests],{cwd:ROOT,stdio:'inherit'});
  return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) process.exitCode=await main();
