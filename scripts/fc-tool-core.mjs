import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DEFAULT_PAC_ROOT = 'D:/pino-ai-ops/control-plane/pac';
const DEFAULT_CACHE_DIR = 'D:/pino-cache/controller/pac';
const DEFAULT_LEGACY_CACHE_DIR = 'D:/pino-cache/controller/pac';
export const FC_PROJECT_URL = process.env.PINO_FC_PROJECT_URL ?? 'https://chatgpt.com/g/g-p-6a8fb098785481919e40a49f3c2c51bd-fc/project';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonical = value => String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
const renderNorm = value => canonical(value).replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[ \t]+$/gm, '');
const hash = value => crypto.createHash('sha256').update(renderNorm(value)).digest('hex');
const now = () => new Date().toISOString();

function slotKey(value) {
  const slot = String(value ?? '').toUpperCase();
  if (!/^FC[123]$/.test(slot)) throw new Error(`FC_TOOL_SLOT_INVALID:${value}`);
  return slot;
}
function statePath(cacheDir, slot) { return path.join(cacheDir, `fc-tool-${slot.toLowerCase()}-state.json`); }
function sharedWriterLockPath(legacyCacheDir, slot) { return path.join(legacyCacheDir, `fc-v2-${slot.toLowerCase()}.lock`); }
function legacyStatePath(legacyCacheDir, slot) { return path.join(legacyCacheDir, `fc-v2-${slot.toLowerCase()}-state.json`); }
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; } }
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
function saveState(cacheDir, slot, patch) {
  const file = statePath(cacheDir, slot);
  const prior = readJson(file, { schemaVersion: 2, slot });
  writeJsonAtomic(file, { ...prior, ...patch, schemaVersion: 2, slot, updatedAt: now() });
  return readJson(file, {});
}
function pidAlive(pid) { const n = Number(pid); if (!Number.isInteger(n) || n <= 0) return false; try { process.kill(n, 0); return true; } catch { return false; } }
async function withSharedWriterLease(legacyCacheDir, slot, fn) {
  const lockFile = sharedWriterLockPath(legacyCacheDir, slot);
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const leaseId = crypto.randomUUID();
  let fd;
  try {
    fd = fs.openSync(lockFile, 'wx');
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = readJson(lockFile, null);
    if (pidAlive(existing?.pid)) throw new Error(`FC_TOOL_WRITER_LEASE_HELD:${slot}:${existing.pid}`);
    throw new Error(`FC_TOOL_STALE_WRITER_LEASE_REQUIRES_RECONCILE:${slot}`);
  }
  const token = { pid: process.pid, slot, leaseId, startedAt: now(), writer: 'FC_TOOL' };
  fs.writeFileSync(fd, JSON.stringify(token));
  let result;
  let primaryError = null;
  try { result = await fn(); } catch (error) { primaryError = error; }
  let releaseError = null;
  try {
    const current = readJson(lockFile, null);
    if (Number(current?.pid) !== process.pid || current?.leaseId !== leaseId) throw new Error(`FC_TOOL_WRITER_LEASE_OWNERSHIP_LOST:${slot}`);
    fs.closeSync(fd);
    fd = null;
    fs.unlinkSync(lockFile);
  } catch (error) { releaseError = error; }
  if (fd != null) { try { fs.closeSync(fd); } catch {} }
  if (primaryError) throw primaryError;
  if (releaseError) throw releaseError;
  return result;
}

export async function loadLiveAdapter(pacRoot = process.env.PINO_PAC_ROOT ?? DEFAULT_PAC_ROOT) {
  const file = path.join(pacRoot, 'src', 'fc-v2-jira-adapter.mjs');
  if (!fs.existsSync(file)) throw new Error(`FC_TOOL_ADAPTER_MISSING:${file}`);
  const adapter = await import(pathToFileURL(file).href + `?fcTool=${Date.now()}`);
  for (const name of ['readSlot','readSession','createStagedSession','activateSession','transitionIssue','setHost','setPrompt','setNextWakeAt','validConversationUrl']) {
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
function normalizedConversationUrl(url) { const u = new URL(String(url)); return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/, '')}`; }
function sameConversationUrl(adapter, expected, actual) {
  try { return adapter.validConversationUrl(expected) && adapter.validConversationUrl(actual) && normalizedConversationUrl(expected) === normalizedConversationUrl(actual); } catch { return false; }
}
function authorityFacts(state) {
  const active = activeSession(state);
  return { host: state.host ?? null, prompt: state.prompt ?? null, nextWakeAt: state.nextWakeAt ?? null, activeSessionKey: active?.key ?? null, activeSessionUrl: active?.description ?? null };
}
function assertFacts(actual, expected, label = 'AUTHORITY') {
  for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) throw new Error(`FC_TOOL_${label}_MISMATCH:${key}`);
}
async function readFacts(adapter, slot) { return authorityFacts(await adapter.readSlot(slot)); }
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
  async function waitBound(page, expectedUrl, timeoutMs=20000) {
    const until=Date.now()+timeoutMs;
    while(Date.now()<until){ const snap=await pageSnapshot(page).catch(()=>null); if(snap && sameConversationUrl(adapter, expectedUrl, snap.href) && snap.composerVisible) return snap; await sleep(250); }
    throw new Error('FC_TOOL_ACTIVE_CONVERSATION_NOT_READY');
  }
  async function wrap(browser, page) {
    return {
      snapshot: () => pageSnapshot(page),
      url: () => page.url(),
      ensureBound: expected => waitBound(page, expected),
      closePage: () => page.close().catch(() => null),
      close: () => browser.close().catch(() => null),
      async composerText() { const c=await findComposer(page); if (!c) return null; return canonical((await c.innerText().catch(() => '')) || (await c.inputValue().catch(() => ''))); },
      async type(text) { const c=await findComposer(page); if (!c) throw new Error('FC_TOOL_COMPOSER_NOT_READY'); await c.focus(); if (typeof c.fill === 'function') await c.fill(text); else await page.keyboard.insertText(text); const actual=canonical((await c.innerText().catch(() => '')) || (await c.inputValue().catch(() => ''))); if (actual !== canonical(text)) throw new Error('FC_TOOL_TYPE_VERIFY_FAILED'); },
      async clickSend() { const button=await findSendButton(page); if (button) return button.click(); await page.keyboard.press('Enter'); },
      async waitRealUrl(timeoutMs=45000) { await page.waitForURL(value => adapter.validConversationUrl(String(value)), { timeout:timeoutMs }); return String(page.url()).split(/[?#]/)[0]; },
      async waitAssistantStable(baselineCount, timeoutMs=180000) { const until=Date.now()+timeoutMs; let last='', stable=0; while(Date.now()<until){ const snap=await pageSnapshot(page); if(snap.assistants.length>baselineCount && !snap.busy){ const text=canonical(snap.assistants.at(-1)?.text); if(text && text===last) stable+=1; else {last=text;stable=0;} if(stable>=2) return text; } await sleep(500); } throw new Error('FC_TOOL_ASSISTANT_TIMEOUT'); },
    };
  }
  return {
    async openActive(slotState) {
      const active=activeSession(slotState); if(!active) return null;
      const expected=String(active.description??'').trim(); if(!adapter.validConversationUrl(expected)) throw new Error(`FC_TOOL_ACTIVE_URL_INVALID:${active.key}`);
      const browser=await connect(slotState.cdpPort); const context=browser.contexts()[0]; if(!context){await browser.close();throw new Error('FC_TOOL_BROWSER_CONTEXT_MISSING');}
      let page=context.pages().find(p=>sameConversationUrl(adapter,expected,p.url()));
      if(!page){page=await context.newPage();await page.goto(expected,{waitUntil:'commit',timeout:45000});}
      try { await waitBound(page, expected); } catch(error) { await browser.close(); throw error; }
      return wrap(browser,page);
    },
    async openProject(slotState) { const browser=await connect(slotState.cdpPort); const context=browser.contexts()[0]; if(!context){await browser.close();throw new Error('FC_TOOL_BROWSER_CONTEXT_MISSING');} const page=await context.newPage(); await page.goto(FC_PROJECT_URL,{waitUntil:'commit',timeout:45000}); return wrap(browser,page); },
  };
}

async function deps(options={}) {
  const adapter = options.adapter ?? await loadLiveAdapter(options.pacRoot);
  const transport = options.transport ?? createPlaywrightTransport(adapter);
  return { adapter, transport, cacheDir: options.cacheDir ?? process.env.PINO_FC_TOOL_CACHE ?? DEFAULT_CACHE_DIR, legacyCacheDir: options.legacyCacheDir ?? process.env.PINO_FC_V2_CACHE ?? DEFAULT_LEGACY_CACHE_DIR, skipWriterLease: options.skipWriterLease === true || options.skipLegacyLease === true };
}
async function withLease(d, slot, fn) { return d.skipWriterLease ? fn() : withSharedWriterLease(d.legacyCacheDir, slot, fn); }
function assertConversation(adapter, expectedUrl, snap) { if (!snap?.composerVisible || !sameConversationUrl(adapter, expectedUrl, snap.href)) throw new Error('FC_TOOL_ACTIVE_CONVERSATION_BINDING_INVALID'); }
function sendOpKey(operationId){return hash(`send-op:${operationId}`);}
function pendingSendOps(state){return Object.values(state?.sendOperations??{}).filter(x=>!['SENT_CONFIRMED','RECONCILED_ACCEPTED'].includes(x?.status));}
function upsertSendOperation(cacheDir,slot,operationId,patch){const prior=readJson(statePath(cacheDir,slot),{}),key=sendOpKey(operationId),ops=prior.sendOperations??{},existing=ops[key]??{};return saveState(cacheDir,slot,{sendOperations:{...ops,[key]:{...existing,...patch,operationId,updatedAt:now()}}});}

export async function observeFc(slotValue, options={}) {
  const slot=slotKey(slotValue), {adapter,transport}=await deps(options), state=await adapter.readSlot(slot), active=activeSession(state);
  let conversation=null;
  if(active){ const live=await transport.openActive(state); try { conversation=live ? await live.snapshot() : null; if(conversation)assertConversation(adapter,active.description,conversation); } finally { if(live) await live.close(); } }
  return {ok:true,tool:'fc.observe',slot,bearer:state.key,host:state.host,prompt:state.prompt,nextWakeAt:state.nextWakeAt,activeSession:active,conversation};
}

export async function sendFc(slotValue, textValue, options={}) {
  const slot=slotKey(slotValue), text=canonical(textValue), operationId=canonical(options.operationId); if(!text) throw new Error('FC_TOOL_SEND_TEXT_REQUIRED'); if(!operationId) throw new Error('FC_TOOL_SEND_OPERATION_REQUIRED');
  const d=await deps(options);
  return withLease(d,slot,async()=>{
    const state=await d.adapter.readSlot(slot), active=activeSession(state); if(!active) throw new Error(`FC_TOOL_NO_ACTIVE_SESSION:${slot}`);
    const activeUrl=String(active.description??'').trim(); if(!d.adapter.validConversationUrl(activeUrl))throw new Error('FC_TOOL_ACTIVE_URL_INVALID');
    const local=readJson(statePath(d.cacheDir,slot),{}),key=sendOpKey(operationId),existing=local.sendOperations?.[key]??null,textHash=hash(text);
    if(existing){
      if(existing.textHash!==textHash||existing.sessionKey!==active.key||!sameConversationUrl(d.adapter,existing.conversationUrl,activeUrl))throw new Error('FC_TOOL_SEND_OPERATION_BINDING_MISMATCH');
      if(['SENT_CONFIRMED','RECONCILED_ACCEPTED'].includes(existing.status))return {ok:true,tool:'fc.send',status:existing.status,idempotent:true,writeAttempted:false,operationId,userId:existing.userId??null};
    } else {
      const unresolved=pendingSendOps(local); if(unresolved.length) return {ok:false,tool:'fc.send',status:'SEND_RECONCILE_REQUIRED',writeAttempted:false,pendingOperationId:unresolved[0].operationId};
      const legacy=readJson(legacyStatePath(d.legacyCacheDir,slot),{}); if(legacy?.pendingSend)return {ok:false,tool:'fc.send',status:'LEGACY_PENDING_SEND_RECONCILE_REQUIRED',writeAttempted:false};
    }
    const live=await d.transport.openActive(state); if(!live) throw new Error(`FC_TOOL_ACTIVE_PAGE_MISSING:${slot}`);
    try {
      const before=await live.snapshot(); assertConversation(d.adapter,activeUrl,before);
      if(existing){
        const baseline=new Set(existing.baselineUserIds??[]),accepted=before.users.find(x=>!baseline.has(x.id)&&renderNorm(x.text)===renderNorm(text));
        if(accepted){upsertSendOperation(d.cacheDir,slot,operationId,{status:'RECONCILED_ACCEPTED',textHash,sessionKey:active.key,conversationUrl:activeUrl,baselineUserIds:[...baseline],userId:accepted.id,acceptedAt:now()});return {ok:true,tool:'fc.send',status:'RECONCILED_ACCEPTED',writeAttempted:false,operationId,userId:accepted.id};}
        const draft=await live.composerText(); if(draft&&renderNorm(draft)===renderNorm(text))return {ok:false,tool:'fc.send',status:'SEND_UNCERTAIN_DRAFT',writeAttempted:false,operationId};
        return {ok:false,tool:'fc.send',status:'SEND_UNCERTAIN_RECONCILE',writeAttempted:false,operationId};
      }
      if(before.busy)return {ok:false,tool:'fc.send',status:'BUSY',writeAttempted:false}; if(before.lastRole&&before.lastRole!=='assistant')return {ok:false,tool:'fc.send',status:'TURN_NOT_YIELDED',writeAttempted:false,lastRole:before.lastRole}; const draft=await live.composerText(); if(draft)return {ok:false,tool:'fc.send',status:'COMPOSER_NOT_EMPTY',writeAttempted:false};
      const baselineUserIds=before.users.map(x=>x.id); upsertSendOperation(d.cacheDir,slot,operationId,{status:'CLAIMED',textHash,sessionKey:active.key,conversationUrl:activeUrl,baselineUserIds,claimedAt:now()});
      await live.type(text);
      const beforeClick=await readFacts(d.adapter,slot); assertFacts(beforeClick,{activeSessionKey:active.key,activeSessionUrl:activeUrl},'SEND_AUTHORITY');
      const snapBeforeClick=await live.snapshot();assertConversation(d.adapter,activeUrl,snapBeforeClick);if(snapBeforeClick.busy)throw new Error('FC_TOOL_SEND_RACE_BUSY');
      await live.clickSend();upsertSendOperation(d.cacheDir,slot,operationId,{status:'CLICKED',textHash,sessionKey:active.key,conversationUrl:activeUrl,baselineUserIds,clickedAt:now()});
      const until=Date.now()+(options.verifyTimeoutMs??20000),baseline=new Set(baselineUserIds);
      while(Date.now()<until){const snap=await live.snapshot();assertConversation(d.adapter,activeUrl,snap);const accepted=snap.users.find(x=>!baseline.has(x.id)&&renderNorm(x.text)===renderNorm(text));if(accepted){upsertSendOperation(d.cacheDir,slot,operationId,{status:'SENT_CONFIRMED',textHash,sessionKey:active.key,conversationUrl:activeUrl,baselineUserIds,userId:accepted.id,acceptedAt:now()});return {ok:true,tool:'fc.send',status:'SENT_CONFIRMED',writeAttempted:true,operationId,userId:accepted.id};}await sleep(250);}
      upsertSendOperation(d.cacheDir,slot,operationId,{status:'UNCERTAIN',textHash,sessionKey:active.key,conversationUrl:activeUrl,baselineUserIds,uncertainAt:now()});return {ok:false,tool:'fc.send',status:'SEND_UNCERTAIN_VERIFY_TIMEOUT',writeAttempted:true,operationId};
    } finally { await live.close(); }
  });
}

async function reconcileRotation(d,slot,txn){
  if(!txn||['COMPLETED','ABORTED_RECONCILED'].includes(txn.phase))return {cleared:true};
  if(!txn.successor?.key)throw new Error(`FC_TOOL_ROTATION_RECONCILE_REQUIRED:${txn.phase}`);
  const state=await d.adapter.readSlot(slot),active=activeSession(state),successor=await d.adapter.readSession(txn.successor.key).catch(()=>null);
  if(active?.key===txn.successor.key&&sameConversationUrl(d.adapter,txn.successor.url,active.description)){
    const completed={...txn,phase:'COMPLETED',reconciled:true,completedAt:now()};saveState(d.cacheDir,slot,{rotationTxn:completed});return {completed:true,result:{ok:true,tool:'fc.rotate',status:'ROTATION_RECONCILED_COMPLETED',slot,predecessor:txn.predecessor?.key??null,successor:txn.successor.key,url:txn.successor.url}};
  }
  if(active?.key===txn.predecessor?.key&&successor?.status==='To Do'&&['ACTIVATION_DISPATCHED','RECOVERY_REQUIRED','CLEANUP_REQUIRED'].includes(txn.phase)){
    await d.adapter.transitionIssue(txn.successor.key,'Done');const reread=await d.adapter.readSession(txn.successor.key);if(reread.status!=='Done'){saveState(d.cacheDir,slot,{rotationTxn:{...txn,phase:'CLEANUP_REQUIRED',observed:{active:active?.key,status:reread.status},updatedAt:now()}});throw new Error('FC_TOOL_ROTATION_CLEANUP_UNVERIFIED');}
    saveState(d.cacheDir,slot,{rotationTxn:{...txn,phase:'ABORTED_RECONCILED',reconciledAt:now()}});return {cleared:true};
  }
  saveState(d.cacheDir,slot,{rotationTxn:{...txn,phase:'RECOVERY_REQUIRED',observed:{active:active?.key??null,successorStatus:successor?.status??null},updatedAt:now()}});throw new Error(`FC_TOOL_ROTATION_RECONCILE_REQUIRED:${txn.phase}`);
}

export async function rotateFc(slotValue, {bootstrap,expectedReceipt}, options={}) {
  const slot=slotKey(slotValue), message=canonical(bootstrap), receipt=canonical(expectedReceipt); if(!message||!receipt) throw new Error('FC_TOOL_ROTATE_BOOTSTRAP_AND_RECEIPT_REQUIRED');
  const d=await deps(options);
  return withLease(d,slot,async()=>{
    const local=readJson(statePath(d.cacheDir,slot),{}),prior=local.rotationTxn;
    if(prior&&!['COMPLETED','ABORTED_RECONCILED'].includes(prior.phase)){const rec=await reconcileRotation(d,slot,prior);if(rec.completed)return rec.result;}
    const current=await d.adapter.readSlot(slot), originalActive=activeSession(current); if(!originalActive) throw new Error(`FC_TOOL_NO_ACTIVE_SESSION:${slot}`);
    const original={key:originalActive.key,url:originalActive.description,host:current.host??null};if(!d.adapter.validConversationUrl(original.url))throw new Error('FC_TOOL_ACTIVE_URL_INVALID');
    const predecessorLive=await d.transport.openActive(current);if(!predecessorLive)throw new Error('FC_TOOL_PREDECESSOR_PAGE_MISSING');try{const snap=await predecessorLive.snapshot();assertConversation(d.adapter,original.url,snap);if(snap.busy)throw new Error('FC_TOOL_ROTATE_PREDECESSOR_BUSY');}finally{await predecessorLive.close();}
    let txn={phase:'PREPARING',predecessor:original,bootstrapHash:hash(message),expectedReceiptHash:hash(receipt),startedAt:now()};saveState(d.cacheDir,slot,{rotationTxn:txn});
    const live=await d.transport.openProject(current);let staged=null;
    try{
      const base=(await live.snapshot()).assistants.length;const draft=await live.composerText();if(draft)throw new Error('FC_TOOL_ROTATE_COMPOSER_NOT_EMPTY');await live.type(message);txn={...txn,phase:'BOOTSTRAP_TYPED'};saveState(d.cacheDir,slot,{rotationTxn:txn});
      await live.clickSend();txn={...txn,phase:'BOOTSTRAP_DISPATCHED',bootstrapDispatchedAt:now()};saveState(d.cacheDir,slot,{rotationTxn:txn});
      const url=await live.waitRealUrl(options.urlTimeoutMs??45000);txn={...txn,phase:'URL_BOUND',url};saveState(d.cacheDir,slot,{rotationTxn:txn});
      staged=await d.adapter.createStagedSession(slot,current.host,url);const stagedRead=await d.adapter.readSession(staged.session);if(stagedRead.status!=='To Do'||!sameConversationUrl(d.adapter,url,stagedRead.description))throw new Error('FC_TOOL_STAGED_READBACK_MISMATCH');txn={...txn,phase:'STAGED_READBACK_PASS',successor:{key:staged.session,url}};saveState(d.cacheDir,slot,{rotationTxn:txn});
      const response=canonical(await live.waitAssistantStable(base,options.bootstrapTimeoutMs??180000));if(response!==receipt)throw new Error(`FC_TOOL_BOOTSTRAP_RECEIPT_INVALID:${response.slice(0,200)}`);txn={...txn,phase:'BOOTSTRAP_VERIFIED'};saveState(d.cacheDir,slot,{rotationTxn:txn});
      const before=await readFacts(d.adapter,slot);assertFacts(before,{host:original.host,activeSessionKey:original.key,activeSessionUrl:original.url},'ROTATE_AUTHORITY');
      const predAgain=await d.transport.openActive(await d.adapter.readSlot(slot));try{const snap=await predAgain.snapshot();assertConversation(d.adapter,original.url,snap);if(snap.busy)throw new Error('FC_TOOL_ROTATE_PREDECESSOR_RACE_BUSY');}finally{await predAgain.close();}
      txn={...txn,phase:'ACTIVATION_DISPATCHED',activationDispatchedAt:now()};saveState(d.cacheDir,slot,{rotationTxn:txn});await d.adapter.activateSession(slot,staged.session,current.host,{closeActive:true});
      const after=await d.adapter.readSlot(slot),active=activeSession(after);if(active?.key!==staged.session||!sameConversationUrl(d.adapter,url,active.description)||after.host!==current.host)throw new Error('FC_TOOL_ACTIVATION_READBACK_MISMATCH');txn={...txn,phase:'COMPLETED',completedAt:now()};saveState(d.cacheDir,slot,{rotationTxn:txn});return {ok:true,tool:'fc.rotate',status:'ROTATION_COMPLETED',slot,predecessor:original.key,successor:staged.session,url,bootstrapHash:txn.bootstrapHash};
    }catch(error){
      const sideEffectful=['BOOTSTRAP_DISPATCHED','URL_BOUND','STAGED_READBACK_PASS','BOOTSTRAP_VERIFIED','ACTIVATION_DISPATCHED'].includes(txn.phase);
      if(txn.phase==='ACTIVATION_DISPATCHED'){try{const rec=await reconcileRotation(d,slot,{...txn,successor:txn.successor??(staged?{key:staged.session,url:txn.url}:null)});if(rec.completed)return rec.result;}catch{}}
      if(!sideEffectful&&staged?.session){try{await d.adapter.transitionIssue(staged.session,'Done');const read=await d.adapter.readSession(staged.session);if(read.status!=='Done')throw new Error('cleanup');txn={...txn,phase:'ABORTED_RECONCILED'};}catch{txn={...txn,phase:'CLEANUP_REQUIRED'};}}
      else if(sideEffectful)txn={...txn,phase:'RECOVERY_REQUIRED'};else txn={...txn,phase:'ABORTED_RECONCILED'};
      saveState(d.cacheDir,slot,{rotationTxn:{...txn,error:String(error?.message??error),failedAt:now(),successor:txn.successor??(staged?{key:staged.session,url:txn.url}:null)}});throw error;
    }finally{await live.close();}
  });
}

async function recoverAuthorityTxn(d,slot,txn){
  if(!txn||['COMPLETED','ABORTED_RESTORED','RECOVERED'].includes(txn.phase))return;
  const original=txn.original;if(!original)throw new Error('FC_TOOL_AUTH_RECOVERY_ORIGINAL_MISSING');
  try{
    const current=await readFacts(d.adapter,slot);assertFacts(current,{activeSessionKey:original.activeSessionKey,activeSessionUrl:original.activeSessionUrl},'AUTH_RECOVERY_ACTIVE');
    await d.adapter.setPrompt(slot,null);let step=await readFacts(d.adapter,slot);assertFacts(step,{activeSessionKey:original.activeSessionKey,activeSessionUrl:original.activeSessionUrl,prompt:null},'AUTH_RECOVERY_FENCE');
    await d.adapter.setHost(slot,original.host);await d.adapter.setNextWakeAt(slot,original.nextWakeAt);step=await readFacts(d.adapter,slot);assertFacts(step,{host:original.host,nextWakeAt:original.nextWakeAt,activeSessionKey:original.activeSessionKey,activeSessionUrl:original.activeSessionUrl,prompt:null},'AUTH_RECOVERY_CORE');
    await d.adapter.setPrompt(slot,original.prompt);step=await readFacts(d.adapter,slot);assertFacts(step,original,'AUTH_RECOVERY_FINAL');saveState(d.cacheDir,slot,{authorityTxn:{...txn,phase:'RECOVERED',readback:step,recoveredAt:now()}});
  }catch(error){saveState(d.cacheDir,slot,{authorityTxn:{...txn,phase:'RECOVERY_REQUIRED',recoveryError:String(error?.message??error),recoveryFailedAt:now()}});throw new Error(`FC_TOOL_AUTH_RECOVERY_REQUIRED:${error?.message??error}`);}
}

export async function applyFcAuthority(slotValue, {expected={},desired={}}, options={}) {
  const slot=slotKey(slotValue), d=await deps(options),target={...desired};if(Object.hasOwn(target,'nextWakeAt')&&target.nextWakeAt!=null){const wake=new Date(target.nextWakeAt);if(!Number.isFinite(wake.getTime()))throw new Error('FC_TOOL_AUTH_WAKE_INVALID');target.nextWakeAt=wake.toISOString();}
  return withLease(d,slot,async()=>{
    const local=readJson(statePath(d.cacheDir,slot),{});if(local.authorityTxn&&!['COMPLETED','ABORTED_RESTORED','RECOVERED'].includes(local.authorityTxn.phase))await recoverAuthorityTxn(d,slot,local.authorityTxn);
    const beforeState=await d.adapter.readSlot(slot),before=authorityFacts(beforeState),active=activeSession(beforeState);for(const [key,value] of Object.entries(expected)){if(!(key in before))throw new Error(`FC_TOOL_AUTH_EXPECTED_KEY_UNSUPPORTED:${key}`);if(before[key]!==value)throw new Error(`FC_TOOL_AUTH_EXPECTED_MISMATCH:${key}`);}let live=null;if(active){live=await d.transport.openActive(beforeState);const snap=await live.snapshot();assertConversation(d.adapter,active.description,snap);if(snap.busy)throw new Error('FC_TOOL_AUTH_BUSY');}
    let txn={phase:'PREPARING',original:before,desired:target,startedAt:now()};saveState(d.cacheDir,slot,{authorityTxn:txn});
    try{
      txn={...txn,phase:'FENCING'};saveState(d.cacheDir,slot,{authorityTxn:txn});await d.adapter.setPrompt(slot,null);let step=await readFacts(d.adapter,slot);assertFacts(step,{host:before.host,nextWakeAt:before.nextWakeAt,activeSessionKey:before.activeSessionKey,activeSessionUrl:before.activeSessionUrl,prompt:null},'AUTH_FENCE');if(live){const snap=await live.snapshot();assertConversation(d.adapter,before.activeSessionUrl,snap);if(snap.busy)throw new Error('FC_TOOL_AUTH_RACE_BUSY');}
      txn={...txn,phase:'MUTATING'};saveState(d.cacheDir,slot,{authorityTxn:txn});if(Object.hasOwn(target,'host')){await d.adapter.setHost(slot,target.host);step=await readFacts(d.adapter,slot);assertFacts(step,{host:target.host,prompt:null,activeSessionKey:before.activeSessionKey,activeSessionUrl:before.activeSessionUrl},'AUTH_HOST');}
      if(Object.hasOwn(target,'nextWakeAt')){await d.adapter.setNextWakeAt(slot,target.nextWakeAt);step=await readFacts(d.adapter,slot);assertFacts(step,{nextWakeAt:target.nextWakeAt,prompt:null,activeSessionKey:before.activeSessionKey,activeSessionUrl:before.activeSessionUrl},'AUTH_WAKE');}
      const finalPrompt=Object.hasOwn(target,'prompt')?target.prompt:before.prompt;await d.adapter.setPrompt(slot,finalPrompt);const after=await readFacts(d.adapter,slot);const expectedFinal={host:Object.hasOwn(target,'host')?target.host:before.host,prompt:finalPrompt,nextWakeAt:Object.hasOwn(target,'nextWakeAt')?target.nextWakeAt:before.nextWakeAt,activeSessionKey:before.activeSessionKey,activeSessionUrl:before.activeSessionUrl};assertFacts(after,expectedFinal,'AUTH_FINAL');txn={...txn,phase:'COMPLETED',readback:after,completedAt:now()};saveState(d.cacheDir,slot,{authorityTxn:txn});return {ok:true,tool:'fc.authority.apply',status:'AUTHORITY_APPLIED',slot,readback:after};
    }catch(error){txn={...txn,phase:'RECOVERY_REQUIRED',error:String(error?.message??error),failedAt:now()};saveState(d.cacheDir,slot,{authorityTxn:txn});try{await recoverAuthorityTxn(d,slot,txn);saveState(d.cacheDir,slot,{authorityTxn:{...txn,phase:'ABORTED_RESTORED',error:String(error?.message??error),restoredAt:now()}});}catch(recoveryError){throw recoveryError;}throw error;}finally{if(live)await live.close();}
  });
}
