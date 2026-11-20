import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

export function validateSelection(surface, feature, revision) {
  if (!["ho","bo","tos"].includes(surface) || typeof feature !== "string" ||
      !/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(feature) ||
      typeof revision !== "string" || !/^[a-f0-9]{40}$/.test(revision)) throw Error("INVALID_LOCAL_SELECTION");
}
export function openQueue(path) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL");
  db.exec("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, surface TEXT NOT NULL, feature TEXT NOT NULL, revision TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('QUEUED','RUNNING','PASS','FAIL','BLOCKED','INVALIDATED')), queued_at TEXT NOT NULL, started_at TEXT, finished_at TEXT, receipt TEXT)");
  const now = () => new Date().toISOString();
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try { const result=fn(); db.exec("COMMIT"); return result; }
    catch(error) { db.exec("ROLLBACK"); throw error; }
  }
  const get=id=>db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
  return {
    enqueue({surface,feature="",revision}) {
      validateSelection(surface,feature,revision);
      const id=createHash("sha256").update(JSON.stringify([surface,feature,revision])).digest("hex");
      db.prepare("INSERT OR IGNORE INTO jobs (id,surface,feature,revision,state,queued_at) VALUES (?,?,?,?,'QUEUED',?)").run(id,surface,feature,revision,now());
      return get(id);
    },
    claim() {
      return transaction(()=>{
        // A crashed or active worker is intentionally not auto-reclaimed.
        if(db.prepare("SELECT id FROM jobs WHERE state='RUNNING' LIMIT 1").get()) return null;
        const row=db.prepare("SELECT * FROM jobs WHERE state='QUEUED' ORDER BY queued_at,rowid LIMIT 1").get();
        if(!row) return null;
        if(db.prepare("UPDATE jobs SET state='RUNNING',started_at=? WHERE id=? AND state='QUEUED'").run(now(),row.id).changes!==1) throw Error("CLAIM_LOST");
        return get(row.id);
      });
    },
    finish(id,state,receipt) {
      if(!["PASS","FAIL","BLOCKED","INVALIDATED"].includes(state)) throw Error("INVALID_TERMINAL_STATE");
      if(db.prepare("UPDATE jobs SET state=?,finished_at=?,receipt=? WHERE id=? AND state='RUNNING'").run(state,now(),JSON.stringify(receipt),id).changes!==1) throw Error("CLAIM_NOT_RUNNING");
      return get(id);
    },
    list(){return db.prepare("SELECT * FROM jobs ORDER BY queued_at,rowid").all();},
    close(){db.close();}
  };
}
