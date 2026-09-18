import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { handleBoSyllabusMediaRequest, type BoSyllabusMediaEnv } from "./bo-syllabus-media-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const session = "local-session-token";
const cfDomain = "team.pino.invalid", cfAudience = "bo-aud";
function env(binding: BoAccessCoreBinding): BoSyllabusMediaEnv { return { PINO_BO_CORE: binding }; }
function binding(operation: (request: BoAccessRequest, token: string) => Promise<{ status: number; body: unknown; requestId: string }>): BoAccessCoreBinding { return { executeWithStaffPassword: operation }; }
function uploadRequest(file: File, key = "syllabus-media-key", authenticated = true) {
  const form = new FormData(); form.set("file", file);
  return new Request("https://bo.pinohouse.art/api/bo/learning/syllabi/media", { method: "POST", headers: { ...(authenticated ? { cookie: `pino_staff_password_session=${session}` } : {}), ...(key ? { "idempotency-key": key } : {}) }, body: form });
}
async function cloudflareFixture(){
  const {privateKey,publicKey}=await generateKeyPair("RS256");
  const jwt=await new SignJWT({email:"owner@pino.invalid"}).setProtectedHeader({alg:"RS256"}).setIssuer(`https://${cfDomain}`).setAudience(cfAudience).setSubject("cf-owner-1").setExpirationTime("2h").sign(privateKey);
  const keyResolver:JWTVerifyGetKey=async()=>publicKey;
  return {jwt,keyResolver};
}

test("Syllabus worksheet upload forwards multipart bytes only through the BO Core facade", async () => {
  const forwarded: BoAccessRequest[] = [];
  const b = binding(async (request, token) => { assert.equal(token, session); forwarded.push(request); return { status: 201, body: { data: { mediaAssetId: id, mimeType: "application/pdf", byteSize: 4, createdAt: "2026-09-05T10:00:00.000Z", fileName: "brief.pdf" } }, requestId: "core-upload" }; });
  const response = await handleBoSyllabusMediaRequest(uploadRequest(new File([new Uint8Array([1,2,3,4])], "brief.pdf", { type: "application/pdf" })), env(b), "learning/syllabi/media");
  assert.equal(response.status, 201); assert.equal(response.headers.get("x-request-id"), "core-upload");
  const captured = forwarded[0]!;
  assert.equal(captured.method, "POST"); assert.equal(captured.path, "learning/syllabi/media"); assert.equal(captured.idempotencyKey, "syllabus-media-key");
  const body = captured.body as { fileName:string; mimeType:string; bytes:ArrayBuffer };
  assert.equal(body.fileName, "brief.pdf"); assert.equal(body.mimeType, "application/pdf"); assert.deepEqual(Array.from(new Uint8Array(body.bytes)), [1,2,3,4]);
});

test("Syllabus worksheet upload fails closed before Core on missing replay evidence or invalid MIME", async () => {
  let calls = 0; const b = binding(async () => { calls += 1; return { status: 200, body: {}, requestId: "unexpected" }; });
  const missing = await handleBoSyllabusMediaRequest(uploadRequest(new File(["pdf"], "brief.pdf", { type: "application/pdf" }), ""), env(b), "learning/syllabi/media");
  const invalid = await handleBoSyllabusMediaRequest(uploadRequest(new File(["text"], "brief.txt", { type: "text/plain" })), env(b), "learning/syllabi/media");
  assert.equal(missing.status, 400); assert.equal(invalid.status, 400); assert.equal(calls, 0);
});

test("Syllabus worksheet preview returns protected inline bytes instead of leaking storage metadata", async () => {
  const path = `learning/syllabi/media/${id}/preview`;
  const b = binding(async (request, token) => { assert.equal(token, session); assert.deepEqual(request, { method: "GET", path }); return { status: 200, body: { data: { mediaAssetId: id, mimeType: "image/png", byteSize: 3, createdAt: "2026-09-05T10:00:00.000Z", bytes: new Uint8Array([7,8,9]).buffer } }, requestId: "core-preview" }; });
  const response = await handleBoSyllabusMediaRequest(new Request(`https://bo.pinohouse.art/api/bo/${path}`, { headers: { cookie: `pino_staff_password_session=${session}` } }), env(b), path);
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "image/png"); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), [7,8,9]);
});

test("Syllabus worksheet preview preserves Core denial", async () => {
  const path = `learning/syllabi/media/${id}/preview`;
  const b = binding(async () => ({ status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "core-denied" }));
  const response = await handleBoSyllabusMediaRequest(new Request(`https://bo.pinohouse.art/api/bo/${path}`, { headers: { cookie: `pino_staff_password_session=${session}` } }), env(b), path);
  assert.equal(response.status, 403); assert.equal(response.headers.get("x-request-id"), "core-denied"); assert.deepEqual(await response.json(), { error: { code: "ACCESS_PERMISSION_DENIED" } });
});

test("Syllabus media preserves Cloudflare BO owner credential compatibility", async () => {
  const {jwt,keyResolver}=await cloudflareFixture();
  const path=`learning/syllabi/media/${id}/preview`;
  let seenIdentity: unknown;
  const b:BoAccessCoreBinding={
    async execute(_request,identity){seenIdentity=identity;return{status:200,body:{data:{mediaAssetId:id,mimeType:"image/png",byteSize:1,createdAt:"2026-09-05T10:00:00.000Z",bytes:new Uint8Array([7]).buffer}},requestId:"cf-preview"};},
    async executeWithStaffPassword(){throw new Error("unexpected password path");},
  };
  const response=await handleBoSyllabusMediaRequest(new Request(`https://bo.pinohouse.art/api/bo/${path}`,{headers:{"cf-access-jwt-assertion":jwt}}),{PINO_BO_CORE:b,CF_ACCESS_TEAM_DOMAIN:cfDomain,CF_ACCESS_BO_AUD:cfAudience},path,keyResolver);
  assert.equal(response.status,200);assert.deepEqual(seenIdentity,{provider:"cloudflare_access",subject:"cf-owner-1",email:"owner@pino.invalid",issuer:`https://${cfDomain}`,audience:[cfAudience],expiresAt:(seenIdentity as {expiresAt:number}).expiresAt});
});
