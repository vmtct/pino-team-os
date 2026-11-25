"use strict";
// PAP-2347 · Persistent native FE preview admission / PLT-M1-DELIVERY.
// Deterministic candidate generator only. Does not install files or manage a process.
const {createHash}=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const BASE="6f67ea0cf3f651af0882afa325eb14835b334b24a099b796ad272049407ae38c";
function hash(bytes){return createHash("sha256").update(bytes).digest("hex");}
function patchGateway(bytes,expected=BASE){
  if(!Buffer.isBuffer(bytes)||hash(bytes)!==expected)throw Error("Gateway baseline changed; stop and reconcile");
  const original=bytes.toString("utf8");
  if(!Buffer.from(original,"utf8").equals(bytes))throw Error("Unsupported gateway encoding");
  const eol=original.includes("\r\n")?"\r\n":"\n";
  let text=original;
  function insert(anchor,lines){
    const first=text.indexOf(anchor);
    if(first<0||text.indexOf(anchor,first+anchor.length)>=0)throw Error("Missing or ambiguous integration anchor");
    text=text.slice(0,first+anchor.length)+eol+lines.join(eol)+text.slice(first+anchor.length);
  }
  insert('const path = require("node:path");',[
    '// PAP-2347 · PLT-M1-DELIVERY — registry only, no additional listener.',
    'const {isNativeRequest,createRegistryDispatch}=require("./native-m1-registry.cjs");',
    'const nativeM1=createRegistryDispatch(path.join(__dirname,"native-m1"));'
  ]);
  insert('  if (!clientAllowed(req.socket)) return report(res, 403, "LAN only");',[
    '  if (nativeM1(req,res)) return;'
  ]);
  insert('  if (!clientAllowed(socket)) return socket.destroy();',[
    '  if (nativeM1.blocksUpgrade(req.url)) return socket.destroy();'
  ]);
  new vm.Script(text,{filename:"gateway-8800.candidate.cjs"});
  return Buffer.from(text,"utf8");
}
if(require.main===module){
  if(process.argv.length!==4)throw Error("Usage: node scripts/prepare-native-m1-gateway.cjs <verified baseline file> <new candidate file>");
  const [source,dest]=process.argv.slice(2).map(p=>path.resolve(p));
  if(source===dest||fs.existsSync(dest))throw Error("Candidate output must be a new file");
  const bytes=patchGateway(fs.readFileSync(source));
  fs.writeFileSync(dest,bytes,{flag:"wx"});
  console.log(JSON.stringify({baseline:BASE,candidateSha256:hash(bytes),candidate:dest,liveMutation:false}));
}
module.exports={patchGateway};
