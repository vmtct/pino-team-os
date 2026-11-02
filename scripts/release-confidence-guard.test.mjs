import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,chmodSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";

const guard=resolve("scripts/assert-no-core-verification-in-flight.sh");
const mockGh = [
'#!/usr/bin/env bash',
'args="$*"',
'case "$args" in',
' *"/repos/vmtct/pino-team-os/actions/runs/39549944942"*) echo \'{"status":"completed","conclusion":"success","head_sha":"f0d8958b3b5fc6b709738193c12bfc4554e2431c"}\' ;;',
' *"/repos/vmtct/pino-team-os/issues/694/comments"*) echo \'[{"user":{"login":"github-actions[bot]"},"body":"ACCESS_SYNC_WORKER_SECRET: **PASS** Workflow run: 39549944942 Team source: f0d8958b3b5fc6b709738193c12bfc4554e2431c"}]\' ;;',
' *"status=queued"*|*"status=in_progress"*)',
'  if [ "$MODE" = "overlap" ] && [[ "$args" = *"status=in_progress"* ]]; then',
'   echo \'{"total_count":1,"workflow_runs":[{"id":1}]}\'',
'  elif [ "$MODE" = "provider" ] && [[ "$args" = *"status=queued"* ]]; then',
'   echo "gh: HTTP 502 Bad Gateway" >&2; exit 1',
'  else echo \'{"total_count":0,"workflow_runs":[]}\'; fi ;;',
' *"/repos/vmtct/pino-core/issues/999/comments"*)',
'  echo \'[{"user":{"login":"github-actions[bot]"},"body":"PINO_CORE_PRODUCTION_RELEASE: **RECOVERY_ARMED** Workflow run: 999 Workflow attempt: 1"}]\' ;;',
' *"/repos/vmtct/pino-core/issues/999"*) echo \'{"comments":1}\' ;;',
' *"status=failure"*|*"status=cancelled"*|*"status=timed_out"*|*"status=action_required"*|*"status=neutral"*|*"status=stale"*|*"status=startup_failure"*)',
'  if [ "$MODE" = "overflow" ]; then echo \'{"total_count":101,"workflow_runs":[]}\'',
'  elif [ "$MODE" = "unresolved" ] && [[ "$args" = *"core-production-release.yml"* ]] && [[ "$args" = *"status=failure"* ]]; then',
'   echo \'{"total_count":1,"workflow_runs":[{"id":999,"run_attempt":1,"conclusion":"failure","display_title":"Core production release #999 @ aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}\'',
'  else echo \'{"total_count":0,"workflow_runs":[]}\'; fi ;;',
' *) echo "Unexpected mock gh request: $args" >&2; exit 1 ;;',
'esac'
].join("\n")+"\n";

test("PAP-867: guard bounds history and cannot paginate unbounded",()=>{
 const source=readFileSync(guard,"utf8");
 assert.equal(source.includes("--paginate"),false);
 assert.match(source,/CORE_RECOVERY_LEDGER_CAPACITY_EXCEEDED/);
 assert.match(source,/UNRESOLVED_RECOVERY/);
});
for(const [mode,expectedCode,marker] of [
  ["healthy",0,null],
  ["overlap",1,"CORE_OVERLAP"],
  ["overflow",1,"CORE_RECOVERY_LEDGER_CAPACITY_EXCEEDED"],
  ["unresolved",1,"UNRESOLVED_RECOVERY"],
  ["provider",2,"CORE_RECOVERY_GITHUB_PROVIDER_UNAVAILABLE"]
]){
 test("PAP-867: Core recovery guard "+mode+" behaves fail-closed",()=>{
   if(process.platform==="win32") return;
   const dir=mkdtempSync(join(tmpdir(),"pino-guard-v2-"));
   try{
     const executable=join(dir,"gh");
     writeFileSync(executable,mockGh);
     chmodSync(executable,0o755);
     const r=spawnSync("bash",[guard],{encoding:"utf8",timeout:30000,env:{...process.env,PATH:dir+":"+process.env.PATH,CORE_RELEASE_GH_TOKEN:"fake",GH_TOKEN:"fake",MODE:mode}});
     assert.equal(r.status,expectedCode,(r.stderr||"")+"\n"+(r.stdout||""));
     if(marker) assert.match(r.stderr,new RegExp(marker));
   }finally{rmSync(dir,{recursive:true,force:true});}
 });
}
