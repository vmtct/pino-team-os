/**
 * PAP-928: harden NEW BO Level-1 entry admission.
 * No generated route may hide or indirectly import an alternate JSX renderer.
 * This supplements PAP-926's frozen route/nav/registry baseline checks.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const CANONICAL = "@/app/bo/architecture/BoModuleFactory";
const STAGING_GATEWAY = "@/app/bo/architecture/BoWorkforceRoute";
const APPROVED_GATEWAY = new Set(["workforce-term-weeks","workforce-shift-plans","workforce-availability","workforce-assignments"]);
const SUFFIXES = [".tsx",".ts",".jsx",".js",".mjs",".cjs","/index.tsx","/index.ts","/index.js"];
const parse = (name,text)=>ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function visit(node,fn){fn(node);ts.forEachChild(node,n=>visit(n,fn));}
function namedImports(node){
  const bindings=node.importClause?.namedBindings;
  return bindings&&ts.isNamedImports(bindings)?bindings.elements.map(x=>x.name.text):[];
}
function resolve(root,from,spec){
  if(!spec.startsWith("./")&&!spec.startsWith("../")&&!spec.startsWith("@/"))return null;
  const base=spec.startsWith("@/")?path.join(root,spec.slice(2)):path.resolve(path.dirname(path.join(root,from)),spec);
  const rel=path.relative(root,base);
  if(rel.startsWith("..")||path.isAbsolute(rel))throw new Error("Import escapes repository: "+spec);
  for(const suffix of SUFFIXES){
    const abs=base+suffix;
    if(fs.existsSync(abs)&&fs.statSync(abs).isFile())return path.relative(root,abs).replaceAll(path.sep,"/");
  }
  throw new Error("Unresolved local import "+spec+" from "+from);
}
function checkedImportGraph(root,start,issues){
  const visited=new Set();
  function walk(file,depth){
    if(visited.has(file))return;
    if(depth>50||visited.size>120){issues.push(start+": adapter import graph is beyond verification bounds");return;}
    visited.add(file);
    if(file==="app/bo/architecture/BoModuleFactory.tsx")return;
    const sf=parse(file,fs.readFileSync(path.join(root,file),"utf8"));
    const deps=[];
    visit(sf,node=>{
      if(ts.isImportDeclaration(node)){
        const spec=ts.isStringLiteral(node.moduleSpecifier)?node.moduleSpecifier.text:null;
        if(!spec){issues.push(file+": import specifier must be static");return;}
        if(spec===CANONICAL)return; // type-only generated adapter dependency
        if(spec.startsWith("./")||spec.startsWith("../")||spec.startsWith("@/"))deps.push(spec);
      }
      if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)||ts.isJsxFragment(node))
        issues.push(file+": transitive custom JSX renderer is forbidden in a BO Level-1 adapter");
      if(ts.isCallExpression(node) &&
          (node.expression.kind===ts.SyntaxKind.ImportKeyword ||
            ts.isIdentifier(node.expression)&&node.expression.text==="require" ||
            ts.isPropertyAccessExpression(node.expression)&&["createElement","jsx","jsxs"].includes(node.expression.name.text)))
        issues.push(file+": dynamic imports/element construction cannot bypass canonical factory");
    });
    for(const spec of deps){
      try {const p=resolve(root,file,spec);if(p)walk(p,depth+1);}
      catch(err){issues.push(file+": "+String(err instanceof Error?err.message:err));}
    }
  }
  walk(start,0);
}
export function auditCanonicalBoRoute(root,file,expectedKey,issues){
  const sf=parse(file,fs.readFileSync(path.join(root,file),"utf8"));
  let factory=false,stagingGateway=false,adapter=false;
  for(const stmt of sf.statements){
    if(!ts.isImportDeclaration(stmt))continue;
    const spec=ts.isStringLiteral(stmt.moduleSpecifier)?stmt.moduleSpecifier.text:"";
    const named=namedImports(stmt);
    if(spec===CANONICAL&&named.length===1&&named[0]==="BoModuleFactory")factory=true;
    else if(spec===STAGING_GATEWAY&&APPROVED_GATEWAY.has(expectedKey)&&named.length===1&&named[0]==="BoWorkforceRoute")stagingGateway=true;
    else if(spec==="./adapter"&&named.length===1&&named[0]==="moduleAdapter")adapter=true;
    else issues.push(file+": Only canonical BoModuleFactory, approved staging gateway + local moduleAdapter imports are allowed");
  }
  const defaultFunctions=sf.statements.filter(node=>ts.isFunctionDeclaration(node)&&
    node.modifiers?.some(mod=>mod.kind===ts.SyntaxKind.DefaultKeyword)&&
    node.modifiers.some(mod=>mod.kind===ts.SyntaxKind.ExportKeyword));
  const fn=defaultFunctions.length===1?defaultFunctions[0]:null;
  const only=fn?.body?.statements;
  const ret=only?.length===1&&ts.isReturnStatement(only[0])?only[0]:null;
  const jsx=ret?.expression;
  let shape=false;
  if(jsx&&ts.isJsxSelfClosingElement(jsx)&&((jsx.tagName.getText(sf)==="BoModuleFactory" && factory) || (jsx.tagName.getText(sf)==="BoWorkforceRoute" && stagingGateway))){
    const attrs=new Map();
    for(const attr of jsx.attributes.properties){
      if(!ts.isJsxAttribute(attr))continue;
      attrs.set(attr.name.text,attr.initializer);
    }
    const m=attrs.get("moduleKey"),a=attrs.get("adapter");
    shape=attrs.size===2&&m&&ts.isStringLiteral(m)&&m.text===expectedKey&&
      a&&ts.isJsxExpression(a)&&a.expression&&ts.isIdentifier(a.expression)&&
      a.expression.text==="moduleAdapter";
  }
  if(!((factory&&!stagingGateway)||(stagingGateway&&!factory))||!adapter||!shape)
    issues.push(file+": NEW BO route must return the single canonical <BoModuleFactory /> entry; no wrappers, dead decoys or alternate render functions");
  let rendered=0;
  visit(sf,node=>{
    if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)||ts.isJsxFragment(node))rendered++;
    if(ts.isCallExpression(node)&&
        (node.expression.kind===ts.SyntaxKind.ImportKeyword||
          ts.isIdentifier(node.expression)&&node.expression.text==="require"))
      issues.push(file+": dynamic import/require is not a canonical BO entry");
  });
  if(rendered!==1)issues.push(file+": hidden extra JSX or bespoke renderer is forbidden at BO Level-1");
  if(adapter){
    try {
      const resolved=resolve(root,file,"./adapter");
      if(resolved)checkedImportGraph(root,resolved,issues);
    } catch(err) {
      issues.push(file+": "+String(err instanceof Error?err.message:err));
    }
  }
}
