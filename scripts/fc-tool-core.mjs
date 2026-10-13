import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DEFAULT_PAC_ROOT = 'D:/pino-ai-ops/control-plane/pac';
const DEFAULT_CACHE_DIR = 'D:/pino-cache/controller/pac';
export const FC_PROJECT_URL = process.env.PINO_FC_PROJECT_URL ?? 'https://chatgpt.com/g/g-p-6a8fb098785481919e40a49f3c2c51bd-fc/project';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonical = value => String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
const renderNorm = value => canonical(value).replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[ \t]+$/gm, '');
const hash = value => crypto.createHash('sha256').update(renderNorm(value)).digest('hex');

function slotKey(value) {
  const slot = String(value ?? '').toUpperCase();
  if (!/^FC[123]$/.test(slot)) throw new Error(`FC_TOOL_SLOT_INVALID:${value}`);
  return slot;
}
function statePath(cacheDir, slot) { return path.join(cacheDir, `fc-tool-${slot.toLowerCase()}-state.json`); }
function toolLockPath(cacheDir, slot) { return path.join(cacheDir, `fc-tool-${slot.toLowerCase()}.lock`); }
function legacyLockPath(cacheDir, slot) { return path.join(cacheDir, `fc-v2-${slot.toLowerCase()}.lock`); }
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; } }
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
function saveState(cacheDir, slot, patch) {
  const file = statePath(cacheDir, slot);
  const prior = readJson(file, { schemaVersion: 1, slot });
  writeJsonAtomic(file, { ...prior, ...patch, schemaVersion: 1, slot, updatedAt: new Date().toISOString() });
  return readJson(file, {});
}
function pidAlive(pid) { const n = Number(pid); if (!Number.isInteger(n) || n <= 0) return false; try { process.kill(n, 0); return true; } catch { return false; } }
function assertLegacyWriterQuiesced(cacheDir, slot, allowPid = null) {
  const lock = readJson(legacyLockPath(cacheDir, slot), null);
  const pid = Number(lock?.pid);
  if (pidAlive(pid) && Number(pid) !== Number(allowPid)) throw new Error(`FC_TOOL_LEGACY_WRITER_ACTIVE:${slot}:${pid}`);
}
async function withToolLease(cacheDir, slot, fn) {
  const lockFile = toolLockPath(cacheDir, slot);
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const existing = readJson(lockFile, null);
  if (pidAlive(existing?.pid)) throw new Error(`FC_TOOL_LEASE_HELD:${slot}:${existing.pid}`);
  try { fs.unlinkSync(lockFile); } catch {}
  const fd = fs.openSync(lockFile, 'wx');
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, slot, startedAt: new Date().toISOString() }));
  try { return await fn(); } finally { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(lockFile); } catch {} }
}

export async function loadLiveAdapter(pacRoot = process.env.PINO_PAC_ROOT ?? DEFAULT_PAC_ROOT) {
  const file = path.join(pacRoot, 'src', 'fc-v2-jira-adapter.mjs');
  if (!fs.existsSync(file)) throw new Error(`FC_TOOL_ADAPTER_MISSING:${file}`);
  const adapter = await import(pathToFileURL(file).href + `?fcTool=${Date.now()}`);
  for (const name of ['readSlot','readSession','createStagedSession','activateSession','transitionIssue','setHost','setPrompt','setNextWakeAt']) {
    if (typeof adapter[name] !== 'function') throw new Error(`FC_TOOL_ADAPTER_CONTRACT_MISSING:${name}`);
  }
  return adapter;
}
function activeSession(slotState) {
  const active = (slotState.sessions ?? []).filter(item => item.status === 'In Progress');
  if (active.length > 1) throw new Error(`FC_TOOL_MULTIPLE_ACTIVE:${slotState.slot}:${active.map(x => x.key).join(',')}`);
  return active[0] ?? null;
}
function conversationId(url) { try { return String(new URL(url).pathname.match(/\/c\/([^/?#]+)/)?.[1] ?? ''); } catch { return ''; } }
async function visible(locator) { return await locator.count().catch(() => 0) > 0 && await locator.isVisible().catch(() => false); }
async function findComposer(page) {
  for (const selector of ['#prompt-textarea','[data-testid="prompt-textarea"]','div.ProseMirror[contenteditable="true"]','[contenteditable="true"][data-composer-markdown]','[contenteditable="true"][role="textbox"]','textarea[placeholder]']) {
    const items = page.locator(selector), count = await items.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) if (await visible(items.nth(i))) return items.nth(i);
  }
  return null;
}
async function findSendButton(page) {
  for (const selector of ['button[data-testid="send-button"]','button[aria-label="Send prompt"]','button[aria-label="Send"]','button[aria-label="Gửi"]']) {
    const button = page.locator(selector).last();
    if (await visible(button) && await button.isEnabled().catch(() => false)) return button;
  }
  return null;
}
async function pageSnapshot(page) {
  return page.evaluate(() => {
    const vis = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const modernUsers = [...document.querySelectorAll('[data-chatgpt-search-unit-key][data-chatgpt-search-message-ids]')].filter(x => (x.getAttribute('data-chatgpt-search-unit-key') || '').endsWith(':user')).map(x => ({ id:(x.getAttribute('data-chatgpt-search-message-ids') || '').trim().split(/\s+/)[0] || null, text:(x.querySelector('[data-user-message-bubble="true"]')?.innerText || x.innerText || '').trim() })).filter(x => x.id);
    const legacyUsers = [...document.querySelectorAll('[data-message-author-role="user"][data-message-id]')].map(x => ({ id:x.getAttribute('data-message-id'), text:(x.innerText || '').trim() }));
    const modernAssistants = [...document.querySelectorAll('[data-chatgpt-search-unit-key][data-chatgpt-search-message-ids]')].filter(x => (x.getAttribute('data-chatgpt-search-unit-key') || '').endsWith(':assistant')).map(x => ({ id:(x.getAttribute('data-chatgpt-search-message-ids') || '').trim().split(/\s+/)[0] || null, text:(x.innerText || '').trim() })).filter(x => x.id);
    const legacyAssistants = [...document.querySelectorAll('[data-message-author-role="assistant"][data-message-id]')].map(x => ({ id:x.getAttribute('data-message-id'), text:(x.innerText || '').trim() }));
    const users = [...new Map([...legacyUsers, ...modernUsers].map(x => [x.id, x])).values()];
    const assistants = [...new Map([...legacyAssistants, ...modernAssistants].map(x => [x.id, x])).values()];
    const turns = [...document.querySelectorAll('[data-chatgpt-search-unit-key]')].map(x => { const k=x.getAttribute('data-chatgpt-search-unit-key') || ''; return k.endsWith(':assistant') ? 'assistant' : k.endsWith(':user') ? 'user' : null; }).filter(Boolean);
    const legacyTurns = [...document.querySelectorAll('[data-message-author-role]')].map(x => x.getAttribute('data-message-author-role')).filter(x => x === 'user' || x === 'assistant');
    const timeline = turns.length ? turns : legacyTurns;
    const busy = [...document.querySelectorAll('button')].filter(vis).some(b => b.getAttribute('data-testid') === 'stop-button' || /(stop answering|stop generating|stop response|^stop$|dừng|ngừng)/i.test(((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || '')).trim()));
    const composerVisible = [...document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],div.ProseMirror[contenteditable="true"],[contenteditable="true"][data-composer-markdown],[contenteditable="true"][role="textbox"],textarea[placeholder]')].some(vis);
    return { href:location.href, busy, users, assistants, lastRole:timeline.at(-1) ?? null, composerVisible };
  });
}

export function createPlaywrightTransport(adapter) {
  let chromiumPromise=null;
  async function chromiumApi(){ if(!chromiumPromise){const root=process.env.PINO_PAC_ROOT??DEFAULT_PAC_ROOT;chromiumPromise=import(pathToFileURL(path.join(root,'node_modules','playwright-core','index.mjs')).href).then(m=>m.chromium);} return chromiumPromise; }
  async function connect(port) { const chromium=await chromiumApi(); return chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 20000 }); }
  async function wrap(browser, page) {
    return {
      snapshot: () => pageSnapshot(page),
      url: () => page.url(),
      closePage: () => page.close().catch(() => null),
      close: () => browser.close().catch(() => null),
      async composerText() { const c=await findComposer(page); if (!c) return null; return canonical((await c.innerText().catch(() => '')) || (await c.inputValue().catch(() => ''))); },
      async type(text) { const c=await findComposer(page); if (!c) throw new Error('FC_TOOL_COMPOSER_NOT_READY'); await c.focus(); if (typeof c.fill === 'function') await c.fill(text); else await page.keyboard.insertText(text); const actual=canonical((await c.innerText().catch(() => '')) || (await c.inputValue().catch(() => ''))); if (actual !== canonical(text)) throw new Error('FC_TOOL_TYPE_VERIFY_FAILED'); },
      async clickSend() { const button=await findSendButton(page); if (button) return button.click(); await page.keyboard.press('Enter'); },
      async waitRealUrl(timeoutMs=45000) { await page.waitForURL(value => adapter.validConversationUrl(String(value)), { timeout:timeoutMs }); return String(page.url()).split(/[?#]/)[0]; },
      async waitUserText(text, timeoutMs=20000) { const expected=renderNorm(text), until=Date.now()+timeoutMs; while(Date.now()<until){ const snap=await pageSnapshot(page); if(snap.users.some(x => renderNorm(x.text)===expected)) return snap; await sleep(250); } return null; },
      async waitAssistantStable(baselineCount, timeoutMs=180000) { const until=Date.now()+timeoutMs; let last='', stable=0; while(Date.now()<until){ const snap=await pageSnapshot(page); if(snap.assistants.length>baselineCount && !snap.busy){ const text=canonical(snap.assistants.at(-1)?.text); if(text && text===last) stable+=1; else {last=text;stable=0;} if(stable>=2) return text; } await sleep(500); } throw new Error('FC_TOOL_ASSISTANT_TIMEOUT'); },
    };
  }
  return {
    async openActive(slotState) { const active=activeSession(slotState); if(!active) return null; const id=conversationId(active.description); if(!id) throw new Error(`FC_TOOL_ACTIVE_URL_INVALID:${active.key}`); const browser=await connect(slotState.cdpPort); const context=browser.contexts()[0]; if(!context){await browser.close();throw new Error('FC_TOOL_BROWSER_CONTEXT_MISSING');} let page=context.pages().find(p=>p.url().includes(`/c/${id}`)); if(!page){page=await context.newPage();await page.goto(active.description,{waitUntil:'commit',timeout:45000});} return wrap(browser,page); },
    async openProject(slotState) { const browser=await connect(slotState.cdpPort); const context=browser.contexts()[0]; if(!context){await browser.close();throw new Error('FC_TOOL_BROWSER_CONTEXT_MISSING');} const page=await context.newPage(); await page.goto(FC_PROJECT_URL,{waitUntil:'commit',timeout:45000}); return wrap(browser,page); },
  };
}

async function deps(options={}) {
  const adapter = options.adapter ?? await loadLiveAdapter(options.pacRoot);
  const transport = options.transport ?? createPlaywrightTransport(adapter);
  return { adapter, transport, cacheDir: options.cacheDir ?? process.env.PINO_FC_TOOL_CACHE ?? DEFAULT_CACHE_DIR, skipLegacyLease: options.skipLegacyLease === true };
}

export async function observeFc(slotValue, options={}) {
  const slot=slotKey(slotValue), {adapter,transport}=await deps(options), state=await adapter.readSlot(slot), active=activeSession(state);
  let conversation=null;
  if(active){ const live=await transport.openActive(state); try { conversation=live ? await live.snapshot() : null; } finally { if(live) await live.close(); } }
  return {ok:true,tool:'fc.observe',slot,bearer:state.key,host:state.host,prompt:state.prompt,nextWakeAt:state.nextWakeAt,activeSession:active,conversation};
}

export async function sendFc(slotValue, textValue, options={}) {
  const slot=slotKey(slotValue), text=canonical(textValue); if(!text) throw new Error('FC_TOOL_SEND_TEXT_REQUIRED');
  const d=await deps(options);
  return withToolLease(d.cacheDir,slot,async()=>{
    if(!d.skipLegacyLease) assertLegacyWriterQuiesced(d.cacheDir,slot,options.allowLegacyPid);
    const state=await d.adapter.readSlot(slot), active=activeSession(state); if(!active) throw new Error(`FC_TOOL_NO_ACTIVE_SESSION:${slot}`);
    const live=await d.transport.openActive(state); if(!live) throw new Error(`FC_TOOL_ACTIVE_PAGE_MISSING:${slot}`);
    try {
      const local=readJson(statePath(d.cacheDir,slot),{}), pending=local.pendingSend;
      if(pending){
        if(pending.sessionKey!==active.key){saveState(d.cacheDir,slot,{pendingSend:null});}
        else { const snap=await live.snapshot(); if(snap.users.some(x=>renderNorm(x.text)===renderNorm(pending.text))){saveState(d.cacheDir,slot,{pendingSend:null,lastSend:{status:'RECONCILED_ACCEPTED',sessionKey:active.key,textHash:pending.textHash,at:new Date().toISOString()}});return {ok:true,tool:'fc.send',status:'SEND_RECONCILED_ACCEPTED',writeAttempted:false,sessionKey:active.key,textHash:pending.textHash};} const draft=await live.composerText(); if(draft&&renderNorm(draft)===renderNorm(pending.text)) return {ok:false,tool:'fc.send',status:'SEND_UNCERTAIN_DRAFT',writeAttempted:false,sessionKey:active.key,textHash:pending.textHash}; const age=Date.now()-Date.parse(pending.clickedAt??pending.claimedAt??''); if(Number.isFinite(age)&&age<=120000)return {ok:false,tool:'fc.send',status:'SEND_UNCERTAIN_RECONCILE',writeAttempted:false,ageMs:age,sessionKey:active.key,textHash:pending.textHash}; throw new Error('FC_TOOL_SEND_UNCERTAIN_NO_EVIDENCE'); }
      }
      const before=await live.snapshot(); if(before.busy) return {ok:false,tool:'fc.send',status:'BUSY',writeAttempted:false}; if(before.lastRole&&before.lastRole!=='assistant') return {ok:false,tool:'fc.send',status:'TURN_NOT_YIELDED',writeAttempted:false,lastRole:before.lastRole}; const existing=await live.composerText(); if(existing) return {ok:false,tool:'fc.send',status:'COMPOSER_NOT_EMPTY',writeAttempted:false};
      const textHash=hash(text); saveState(d.cacheDir,slot,{pendingSend:{sessionKey:active.key,text,textHash,claimedAt:new Date().toISOString()}}); await live.type(text); await live.clickSend(); saveState(d.cacheDir,slot,{pendingSend:{sessionKey:active.key,text,textHash,claimedAt:readJson(statePath(d.cacheDir,slot),{})?.pendingSend?.claimedAt??new Date().toISOString(),clickedAt:new Date().toISOString()}});
      const accepted=await live.waitUserText(text,options.verifyTimeoutMs??20000); if(!accepted) return {ok:false,tool:'fc.send',status:'SEND_UNCERTAIN_VERIFY_TIMEOUT',writeAttempted:true,sessionKey:active.key,textHash}; saveState(d.cacheDir,slot,{pendingSend:null,lastSend:{status:'SENT_CONFIRMED',sessionKey:active.key,textHash,at:new Date().toISOString()}}); return {ok:true,tool:'fc.send',status:'SENT_CONFIRMED',writeAttempted:true,sessionKey:active.key,textHash};
    } finally { await live.close(); }
  });
}

export async function rotateFc(slotValue, {bootstrap,expectedReceipt}, options={}) {
  const slot=slotKey(slotValue), message=canonical(bootstrap), receipt=canonical(expectedReceipt); if(!message||!receipt) throw new Error('FC_TOOL_ROTATE_BOOTSTRAP_AND_RECEIPT_REQUIRED');
  const d=await deps(options);
  return withToolLease(d.cacheDir,slot,async()=>{
    if(!d.skipLegacyLease) assertLegacyWriterQuiesced(d.cacheDir,slot,options.allowLegacyPid);
    const current=await d.adapter.readSlot(slot), original=activeSession(current); if(!original) throw new Error(`FC_TOOL_NO_ACTIVE_SESSION:${slot}`);
    const prior=readJson(statePath(d.cacheDir,slot),{})?.rotationTxn; if(prior&&!['COMPLETED','ABORTED'].includes(prior.phase)) throw new Error(`FC_TOOL_ROTATION_RECONCILE_REQUIRED:${prior.phase}`);
    let txn={phase:'PREPARING',predecessor:original.key,bootstrapHash:hash(message),expectedReceiptHash:hash(receipt),startedAt:new Date().toISOString()}; saveState(d.cacheDir,slot,{rotationTxn:txn});
    const live=await d.transport.openProject(current); let staged=null, activated=false;
    try {
      const base=(await live.snapshot()).assistants.length; const existing=await live.composerText(); if(existing) throw new Error('FC_TOOL_ROTATE_COMPOSER_NOT_EMPTY'); await live.type(message); txn={...txn,phase:'BOOTSTRAP_SENDING'};saveState(d.cacheDir,slot,{rotationTxn:txn}); await live.clickSend(); const url=await live.waitRealUrl(options.urlTimeoutMs??45000); txn={...txn,phase:'URL_BOUND',url};saveState(d.cacheDir,slot,{rotationTxn:txn});
      staged=await d.adapter.createStagedSession(slot,current.host,url); const stagedRead=await d.adapter.readSession(staged.session); if(stagedRead.status!=='To Do'||stagedRead.description!==url) throw new Error('FC_TOOL_STAGED_READBACK_MISMATCH'); txn={...txn,phase:'STAGED_READBACK_PASS',successor:staged.session,url};saveState(d.cacheDir,slot,{rotationTxn:txn});
      const response=canonical(await live.waitAssistantStable(base,options.bootstrapTimeoutMs??180000)); if(response!==receipt) throw new Error(`FC_TOOL_BOOTSTRAP_RECEIPT_INVALID:${response.slice(0,200)}`); txn={...txn,phase:'BOOTSTRAP_VERIFIED'};saveState(d.cacheDir,slot,{rotationTxn:txn});
      const before=await d.adapter.readSlot(slot); if(activeSession(before)?.key!==original.key) throw new Error('FC_TOOL_PREDECESSOR_CHANGED'); txn={...txn,phase:'ACTIVATING'};saveState(d.cacheDir,slot,{rotationTxn:txn}); await d.adapter.activateSession(slot,staged.session,current.host,{closeActive:true}); activated=true; const after=await d.adapter.readSlot(slot), active=activeSession(after); if(active?.key!==staged.session||active.description!==url) throw new Error('FC_TOOL_ACTIVATION_READBACK_MISMATCH'); txn={...txn,phase:'COMPLETED',completedAt:new Date().toISOString()};saveState(d.cacheDir,slot,{rotationTxn:txn}); return {ok:true,tool:'fc.rotate',status:'ROTATION_COMPLETED',slot,predecessor:original.key,successor:staged.session,url,bootstrapHash:txn.bootstrapHash};
    } catch(error) {
      if(staged?.session&&!activated){try{const read=await d.adapter.readSession(staged.session);if(read.status==='To Do')await d.adapter.transitionIssue(staged.session,'Done');}catch{}}
      if(txn.phase==='ACTIVATING'&&!activated){try{const now=await d.adapter.readSlot(slot),active=activeSession(now);if(!active){await d.adapter.transitionIssue(original.key,'In Progress');}}catch{}}
      saveState(d.cacheDir,slot,{rotationTxn:{...txn,phase:'ABORTED',error:String(error?.message??error),abortedAt:new Date().toISOString()}}); throw error;
    } finally { await live.close(); }
  });
}

export async function applyFcAuthority(slotValue, {expected={},desired={}}, options={}) {
  const slot=slotKey(slotValue), d=await deps(options);
  const target={...desired}; if(Object.hasOwn(target,'nextWakeAt')&&target.nextWakeAt!=null){const wake=new Date(target.nextWakeAt);if(!Number.isFinite(wake.getTime()))throw new Error('FC_TOOL_AUTH_WAKE_INVALID');target.nextWakeAt=wake.toISOString();}
  return withToolLease(d.cacheDir,slot,async()=>{
    if(!d.skipLegacyLease) assertLegacyWriterQuiesced(d.cacheDir,slot,options.allowLegacyPid);
    const before=await d.adapter.readSlot(slot), active=activeSession(before);
    const actual={host:before.host??null,prompt:before.prompt??null,nextWakeAt:before.nextWakeAt??null,activeSessionKey:active?.key??null};
    for(const [key,value] of Object.entries(expected)){if(!(key in actual))throw new Error(`FC_TOOL_AUTH_EXPECTED_KEY_UNSUPPORTED:${key}`);if(actual[key]!==value)throw new Error(`FC_TOOL_AUTH_EXPECTED_MISMATCH:${key}`);}
    let live=null; if(active){live=await d.transport.openActive(before);const snap=live?await live.snapshot():null;if(snap?.busy){if(live)await live.close();throw new Error('FC_TOOL_AUTH_BUSY');}}
    const txn={phase:'PREPARING',original:actual,desired:target,startedAt:new Date().toISOString()};saveState(d.cacheDir,slot,{authorityTxn:txn});
    try {
      await d.adapter.setPrompt(slot,null); if(live){const raced=await live.snapshot();if(raced.busy)throw new Error('FC_TOOL_AUTH_RACE_BUSY');}
      if(Object.hasOwn(target,'host')) await d.adapter.setHost(slot,target.host);
      if(Object.hasOwn(target,'nextWakeAt')) await d.adapter.setNextWakeAt(slot,target.nextWakeAt);
      if(Object.hasOwn(target,'prompt')) await d.adapter.setPrompt(slot,target.prompt); else await d.adapter.setPrompt(slot,before.prompt);
      const after=await d.adapter.readSlot(slot), afterActive=activeSession(after), readback={host:after.host??null,prompt:after.prompt??null,nextWakeAt:after.nextWakeAt??null,activeSessionKey:afterActive?.key??null};
      for(const key of ['host','prompt','nextWakeAt']) if(Object.hasOwn(target,key) && readback[key]!==target[key]) throw new Error(`FC_TOOL_AUTH_READBACK_MISMATCH:${key}`);
      saveState(d.cacheDir,slot,{authorityTxn:{...txn,phase:'COMPLETED',readback,completedAt:new Date().toISOString()}}); return {ok:true,tool:'fc.authority.apply',status:'AUTHORITY_APPLIED',slot,readback};
    } catch(error) {
      await d.adapter.setHost(slot,before.host).catch(()=>null); await d.adapter.setNextWakeAt(slot,before.nextWakeAt).catch(()=>null); await d.adapter.setPrompt(slot,before.prompt).catch(()=>null); saveState(d.cacheDir,slot,{authorityTxn:{...txn,phase:'ABORTED',error:String(error?.message??error),abortedAt:new Date().toISOString()}}); throw error;
    } finally { if(live)await live.close(); }
  });
}
