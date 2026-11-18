/** PAP-2134: tab-scoped retry receipt. No caption, student ID, post ID or actor ID
 * stored in plaintext. Not a server receipt, authorization grant or cross-tab lock.
 * Caller must re-enter exact command after reload, and reconcile if unable. */
export type DraftRetryReceipt={readonly key:string;readonly fingerprint:string};
export type DraftRetryJournal={
 read(scope:string):DraftRetryReceipt|null;
 reserve(scope:string,receipt:DraftRetryReceipt):DraftRetryReceipt;
 clear(scope:string,receipt:DraftRetryReceipt):void;
};
const digestPattern=/^[0-9a-f]{64}$/;
const keyPattern=/^[A-Za-z0-9_-]{16,128}$/;
export async function draftDigest(input:readonly unknown[]):Promise<string>{
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(input)));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
const matches=(a:DraftRetryReceipt,b:DraftRetryReceipt)=>a.key===b.key&&a.fingerprint===b.fingerprint;
export function createSessionDraftJournal(storage:Pick<Storage,"getItem"|"setItem"|"removeItem">):DraftRetryJournal{
 const slot=(scope:string)=>{if(!digestPattern.test(scope))throw Error("Retry scope invalid.");return "pino:posts:draft-retry:v1:"+scope;};
 const read=(scope:string):DraftRetryReceipt|null=>{
  const value=storage.getItem(slot(scope));if(value===null)return null;
  const entry:unknown=JSON.parse(value);
  if(!entry||typeof entry!=="object"||Array.isArray(entry))throw Error("Retry receipt invalid.");
  const r=entry as Record<string,unknown>;
  if(Object.keys(r).length!==2||typeof r.key!=="string"||!keyPattern.test(r.key)||typeof r.fingerprint!=="string"||!digestPattern.test(r.fingerprint))throw Error("Retry receipt invalid.");
  return {key:r.key,fingerprint:r.fingerprint};
 };
 return {
  read,
  reserve(scope,receipt){
   if(!keyPattern.test(receipt.key)||!digestPattern.test(receipt.fingerprint))throw Error("Retry receipt invalid.");
   const prior=read(scope);if(prior)return prior;
   storage.setItem(slot(scope),JSON.stringify({key:receipt.key,fingerprint:receipt.fingerprint}));
   const stored=read(scope);if(!stored||!matches(stored,receipt))throw Error("Retry receipt unavailable.");
   return stored;
  },
  clear(scope,receipt){const existing=read(scope);if(existing&&matches(existing,receipt))storage.removeItem(slot(scope));}
 };
}
