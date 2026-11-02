/** Parses build manifest evidence without equating it with an attested deployed Worker digest. */
export function parseBuildManifestProvenance(value:unknown):string|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const o=value as Record<string,unknown>;
 if(Object.keys(o).sort().join(",")!=="digest,kind,schemaVersion")return null;
 return o.schemaVersion===1&&o.kind==="NEXT_BUILD_MANIFEST_SHA256"&&typeof o.digest==="string"&&/^[0-9a-f]{64}$/.test(o.digest)?o.digest:null;
}
export async function fetchBuildManifestProvenance(fetcher:typeof fetch=fetch):Promise<string|null>{
 try {
  const response=await fetcher("/pap659-build-provenance.json",{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)return null;
  return parseBuildManifestProvenance(await response.json());
 }catch{return null;}
}
