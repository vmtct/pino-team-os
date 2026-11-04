// PAP-1413 / Epic PAP-1365: isolated authenticated BO Students READ_ONLY smoke.
// Never writes data, copies browser credentials, or asserts full business E2E acceptance.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const BO_URL = "https://bo.staging.pinohouse.art/bo?module=students";
const CHROME_CDP = "http://127.0.0.1:9335";
const sleep = ms => new Promise(done => setTimeout(done, ms));

export function validateAdmission(env) {
  const errors = [];
  if (env.PAP1413_READ_ONLY !== "1") errors.push("PAP1413_READ_ONLY=1 opt-in required");
  if (env.CI) errors.push("Authenticated local CDP must not run in CI");
  if (env.PAP1413_CDP_URL && env.PAP1413_CDP_URL !== CHROME_CDP) errors.push("Only i5 localhost Manager CDP 9335 allowed");
  if (env.PAP1413_BO_URL && env.PAP1413_BO_URL !== BO_URL) errors.push("Only fixed BO Staging origin/route allowed");
  if (env.PAP1413_CENTER_NAME && env.PAP1413_CENTER_NAME !== "Cần Thơ") errors.push("Unexpected Center; no fallback or guessed Center");
  return errors;
}

export function classifyReadSmoke(observation) {
  if (!observation.centerSelected) return { outcome: "BLOCKED", reason: "AUTHORIZED_CENTER_NOT_SELECTED" };
  if (!observation.studentRows) return { outcome: "BLOCKED", reason: "NO_AUTHORIZED_STUDENT_ROWS" };
  if (!observation.quickView) return { outcome: "FAIL", reason: "STUDENT_QUICK_VIEW_NOT_OPEN" };
  if (!observation.fullDetail) return { outcome: "FAIL", reason: "STUDENT_DETAIL_NOT_OPEN" };
  if (observation.editControls !== 0) return { outcome: "BLOCKED", reason: "PROFILE_EDIT_PERMISSION_CONTRACT_CHANGED" };
  return { outcome: "PASS", reason: "READ_ONLY_TABLE_DRAWER_DETAIL" };
}

class CdpSession {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.waiting = new Map();
    socket.addEventListener("message", event => {
      const packet = JSON.parse(event.data);
      const pending = this.waiting.get(packet.id);
      if (!pending) return;
      this.waiting.delete(packet.id);
      clearTimeout(pending.timer);
      pending.resolve(packet);
    });
  }
  async command(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) throw Error("CDP socket is not open");
    const id = ++this.sequence;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(Error("CDP " + method + " timed out"));
      }, 8000);
      this.waiting.set(id, { resolve, reject, timer });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    const reply = await promise;
    if (reply.error) throw Error("CDP " + method + " returned protocol error");
    return reply.result;
  }
  async evaluate(expression) {
    const result = await this.command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error("CDP DOM evaluation failed");
    return result.result?.value;
  }
  close() {
    for (const item of this.waiting.values()) clearTimeout(item.timer);
    this.waiting.clear();
    this.socket.close();
  }
}

async function connectCDP(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("CDP connect timeout")), 6000);
    ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(timer); reject(Error("CDP connect failed")); }, { once: true });
  });
  return new CdpSession(ws);
}

async function run() {
  const errors = validateAdmission(process.env);
  if (errors.length) throw Error("READ_ONLY_ADMISSION_BLOCKED: " + errors.join("; "));
  const observation = { caseId: "PAP-1413-MANAGER-READ-001", centerSelected: false, studentRows: 0, quickView: false, fullDetail: false, editControls: null, businessE2E: false, servingShaVerified: false, noDataWrites: true };
  let tab = null;
  let cdp = null;
  let closed = false;
  try {
    const response = await fetch(CHROME_CDP + "/json/new?" + BO_URL, { method: "PUT", signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw Error("CDP tab create failed");
    tab = await response.json();
    cdp = await connectCDP(tab.webSocketDebuggerUrl);
    await cdp.command("Runtime.enable");
    await sleep(12000);

    // Click only an actual Core-authorized visible Center option (never a forged URL/header).
    observation.centerSelected = await cdp.evaluate('(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Cần Thơ");if(!b)return false;b.click();return true})()');
    if (!observation.centerSelected) return observation;
    await sleep(4000);
    observation.studentRows = await cdp.evaluate('(()=>document.querySelectorAll("tbody tr").length)()');
    if (!observation.studentRows) return observation;

    observation.quickView = await cdp.evaluate('(()=>{const b=document.querySelector("tbody [aria-label^=\u0027Quick View\u0027]");if(!b)return false;b.click();return true})()');
    if (!observation.quickView) return observation;
    await sleep(2500);

    // BO Staging Full Detail is a BUTTON, not an anchor (previous locator false-negative).
    observation.fullDetail = await cdp.evaluate('(()=>{const b=[...document.querySelectorAll("button")].find(x=>/Full Detail/i.test(x.textContent||""));if(!b)return false;b.click();return true})()');
    if (!observation.fullDetail) return observation;
    await sleep(3200);
    const state = await cdp.evaluate('(()=>({headings:document.querySelectorAll("h1").length,history:[...document.querySelectorAll("button")].some(x=>/Lịch Sử/i.test(x.textContent||"")),editControls:document.querySelectorAll("button[aria-label=\u0027Chỉnh sửa tên học viên\u0027],button[aria-label=\u0027Chỉnh sửa trạng thái học viên\u0027]").length}))()');
    observation.fullDetail = state.headings > 0 && state.history;
    observation.editControls = state.editControls;
    return observation;
  } finally {
    try { cdp?.close(); } catch {}
    if (tab?.id) {
      // Close ONLY the tab created by this run. Never close existing Founder/Manager tabs.
      const response = await fetch(CHROME_CDP + "/json/close/" + tab.id, { signal: AbortSignal.timeout(6500) });
      closed = response.ok;
    }
    observation.createdTabClosed = closed;
  }
}

export async function main() {
  const errors = validateAdmission(process.env);
  if (errors.length) {
    console.error(JSON.stringify({ task: "PAP-1413", outcome: "BLOCKED", reasons: errors }));
    return 2;
  }
  try {
    const observation = await run();
    const result = classifyReadSmoke(observation);
    if (!observation.createdTabClosed) {
      console.error(JSON.stringify({ task: "PAP-1413", outcome: "BLOCKED", reason: "TEST_TAB_CLOSE_UNVERIFIED" }));
      return 2;
    }
    // Never log Student names, IDs, raw DOM, cookies, or tokens.
    console.log(JSON.stringify({ task: "PAP-1413", ...result, rowsOnPage: observation.studentRows, quickView: observation.quickView, fullDetail: observation.fullDetail, editControls: observation.editControls, createdTabClosed: observation.createdTabClosed, businessE2E: false, servingShaVerified: false, noDataWrites: true }));
    return result.outcome === "PASS" ? 0 : result.outcome === "BLOCKED" ? 2 : 1;
  } catch (error) {
    console.error(JSON.stringify({ task: "PAP-1413", outcome: "BLOCKED", reason: "BROWSER_OR_HARNESS_ERROR", detail: String(error.message).slice(0, 120) }));
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
