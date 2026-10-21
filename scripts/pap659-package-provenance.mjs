import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBuildManifestProvenance} from './pap659-build-provenance.mjs';

/** Copies build evidence into the OpenNext asset directory, but only after a byte-for-byte digest match. */
export async function packageProvenance(nextDirectory,assetDirectory){
 const expected=await createBuildManifestProvenance(nextDirectory);
 const record=JSON.parse(await readFile(join(nextDirectory,'pap659-build-provenance.json'),'utf8'));
 if(record?.schemaVersion!==1||record?.kind!==expected.kind||record?.digest!==expected.digest)throw new Error('PAP659_PROVENANCE_MISMATCH');
 await mkdir(assetDirectory,{recursive:true});
 await writeFile(join(assetDirectory,'pap659-build-provenance.json'),JSON.stringify(expected)+'\n');
 return expected;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const evidence=await packageProvenance(process.argv[2]||'.next',process.argv[3]||'.open-next/assets');
 process.stdout.write(`PAP659_ASSET_PACKAGED ${evidence.digest}\n`);
}
