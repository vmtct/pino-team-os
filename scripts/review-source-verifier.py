#!/usr/bin/env python3
import argparse,base64,datetime,hashlib,json,os,re,sqlite3,subprocess,sys,time

CODEX_HOME=os.environ.get('PINO_CODEX_SOURCE_HOME','/home/tri/.codex-vmtct97')
PAC_TOKEN=os.environ.get('PINO_PAC_TOKEN_WSL','/mnt/d/pino-cache/controller/pac/gateway.token')
PAC_GATEWAY=os.environ.get('PINO_PAC_GATEWAY','http://127.0.0.1:9461')
CURL_EXE=os.environ.get('PINO_WINDOWS_CURL','/mnt/c/Windows/System32/curl.exe')
CAPACITY_OBSERVATION=os.environ.get('PINO_CODEX_CAPACITY_OBSERVATION','/mnt/c/Users/ADMIN/Documents/PINO_SOP/state/codex-capacity/vmtct97.json')

def stable(v):
    if isinstance(v,dict): return {k:stable(v[k]) for k in sorted(v)}
    if isinstance(v,list): return [stable(x) for x in v]
    return v

def digest(v): return hashlib.sha256(json.dumps(stable(v),separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def wsl_path(p):
    x=str(p or '').replace('\\','/');m=re.match(r'^([A-Za-z]):/(.*)$',x);return '/mnt/'+m.group(1).lower()+'/'+m.group(2) if m else x
def fail(msg,code=42): print('ERROR: '+msg,file=sys.stderr); raise SystemExit(code)
def decode_json_b64(raw):
    try: return json.loads(base64.urlsafe_b64decode(raw+'='*((4-len(raw)%4)%4)).decode())
    except Exception as e: fail('SOURCE_RESULT_B64_INVALID:'+str(e))
def readonly_sandbox(raw):
    try: x=json.loads(raw or '{}')
    except Exception:return False
    fs=(x.get('file_system') or {})
    entries=fs.get('entries') or []
    return x.get('type')=='managed' and bool(entries) and all(e.get('access')=='read' for e in entries)
def codex_thread(thread_id):
    s=sqlite3.connect(os.path.join(CODEX_HOME,'state_5.sqlite'));s.row_factory=sqlite3.Row
    h=sqlite3.connect(os.path.join(CODEX_HOME,'thread_history_1.sqlite'));h.row_factory=sqlite3.Row
    t=s.execute('select id,source,model_provider,cwd,sandbox_policy,approval_mode,git_sha,git_origin_url,cli_version,first_user_message,model from threads where id=?',(thread_id,)).fetchone()
    if not t: fail('CODEX_SOURCE_THREAD_MISSING')
    turns=h.execute('select thread_id,turn_id,status,error_json,started_at,completed_at,final_agent_item_id from thread_turns where thread_id=? order by rollout_ordinal',(thread_id,)).fetchall()
    if not turns: fail('CODEX_SOURCE_TURN_MISSING')
    return s,h,dict(t),[dict(x) for x in turns]
def validate_codex_common(t,candidate):
    if t.get('model_provider')!='openai': fail('CODEX_SOURCE_PROVIDER_INVALID')
    if t.get('git_sha')!=candidate: fail('CODEX_SOURCE_CANDIDATE_MISMATCH')
    if t.get('approval_mode')!='never' or not readonly_sandbox(t.get('sandbox_policy')): fail('CODEX_SOURCE_READONLY_INVALID')
    if candidate not in str(t.get('first_user_message') or ''): fail('CODEX_SOURCE_PROMPT_CANDIDATE_MISSING')
def risk_binding_prompt(prompt,a):
    hm=re.findall(r'(?m)^PINO_RISK_CONTRACT_HASH: ([0-9a-f]{64}|NONE)\s*$',prompt); fm=re.findall(r'(?m)^PINO_REQUIRED_RISK_FAMILIES_JSON: (\[.*\])\s*$',prompt)
    if not getattr(a,'risk_hash',None) and not getattr(a,'risk_families_json',None) and (not hm or not fm): return (None,None)
    if len(hm)!=1 or len(fm)!=1: fail('CODEX_SOURCE_RISK_BINDING_MISSING')
    try: families=json.loads(fm[0])
    except Exception as e: fail('CODEX_SOURCE_RISK_FAMILIES_JSON_INVALID:'+str(e))
    if not isinstance(families,list) or any(not isinstance(x,str) for x in families): fail('CODEX_SOURCE_RISK_FAMILIES_INVALID')
    if getattr(a,'risk_hash',None) and hm[0]!=a.risk_hash: fail('CODEX_SOURCE_RISK_HASH_MISMATCH')
    if getattr(a,'risk_families_json',None):
        try: expected=json.loads(a.risk_families_json)
        except Exception as e: fail('CODEX_SOURCE_EXPECTED_RISK_JSON_INVALID:'+str(e))
        if stable(families)!=stable(expected): fail('CODEX_SOURCE_RISK_FAMILIES_MISMATCH')
    return (hm[0],families)
def codex_risk_binding(t,a): return risk_binding_prompt(str(t.get('first_user_message') or ''),a)
def audit_identity_sha(text):
    x=str(text or '').replace('\r\n','\n').replace('\r','\n').strip().replace('\u00a0',' ')
    x=re.sub('[\u200b-\u200d\ufeff]','',x);x='\n'.join(line.rstrip(' \t') for line in x.split('\n'));x=re.sub('\n{2,}','\n',x)
    return hashlib.sha256(x.encode()).hexdigest()
def codex_direct(a):
    expected=decode_json_b64(a.result_b64); s,h,t,turns=codex_thread(a.thread); validate_codex_common(t,a.candidate)
    prompt=str(t.get('first_user_message') or ''); risk_hash,risk_families=codex_risk_binding(t,a)
    if f'Repository: {a.repository}' not in prompt or f'PR: #{a.pr}' not in prompt or f'Review mode: {a.review_kind}' not in prompt: fail('CODEX_SOURCE_PROMPT_BINDING_INVALID')
    completed=[x for x in turns if x.get('status')=='completed' and x.get('final_agent_item_id')]
    if len(completed)!=1: fail('CODEX_SOURCE_COMPLETED_TURN_COUNT_INVALID')
    turn=completed[0]; row=h.execute('select item_type,item_json from thread_items where thread_id=? and item_id=?',(a.thread,turn['final_agent_item_id'])).fetchone()
    if not row or row['item_type']!='agentMessage': fail('CODEX_SOURCE_FINAL_ITEM_INVALID')
    item=json.loads(row['item_json']); text=str(item.get('text') or '')
    hits=[x.strip()[len('PINO_AUDIT_RESULT_JSON='):] for x in text.replace('\r','').split('\n') if x.strip().startswith('PINO_AUDIT_RESULT_JSON=')]
    if len(hits)!=1: fail('CODEX_SOURCE_RESULT_LINE_COUNT_INVALID')
    try: actual=json.loads(hits[0])
    except Exception as e: fail('CODEX_SOURCE_RESULT_JSON_INVALID:'+str(e))
    if stable(actual)!=stable(expected): fail('CODEX_SOURCE_RESULT_MISMATCH')
    selected={'kind':'CODEX_THREAD_RESULT_V1','threadId':a.thread,'riskContractHash':risk_hash,'requiredRiskFamilies':risk_families,'thread':{k:t.get(k) for k in ('source','model_provider','cwd','sandbox_policy','approval_mode','git_sha','git_origin_url','cli_version','model')},'turn':{k:turn.get(k) for k in ('turn_id','status','started_at','completed_at','final_agent_item_id')},'result':actual}
    out={'ok':True,'kind':'CODEX_THREAD_RESULT_V1','sourceReceiptSha256':digest(selected),'threadId':a.thread,'riskContractHash':risk_hash,'requiredRiskFamilies':risk_families}; print(json.dumps(out,separators=(',',':')))
def active_capacity_reuse(a,t):
    if not os.path.isfile(CAPACITY_OBSERVATION): fail('CODEX_CAPACITY_REUSE_OBSERVATION_MISSING')
    try: obs=json.load(open(CAPACITY_OBSERVATION,encoding='utf-8-sig'))
    except Exception as e: fail('CODEX_CAPACITY_REUSE_OBSERVATION_INVALID:'+str(e))
    if obs.get('schemaVersion')!=1 or obs.get('kind')!='PINO_CODEX_CAPACITY_OBSERVATION' or obs.get('provider')!='OPENAI_CODEX' or obs.get('capacityDomain')!='openai:vmtct97' or obs.get('profileId')!='vmtct97' or obs.get('state')!='EXHAUSTED' or obs.get('allAuthenticatedProfilesExhausted') is not True: fail('CODEX_CAPACITY_REUSE_OBSERVATION_BINDING_INVALID')
    try: reset_at=datetime.datetime.fromisoformat(str(obs.get('resetAt') or '')).timestamp()
    except Exception: fail('CODEX_CAPACITY_REUSE_RESET_AT_INVALID')
    if reset_at<=time.time(): fail('CODEX_CAPACITY_REUSE_EXPIRED')
    evidence=str(obs.get('providerEvidence') or '')
    if not evidence or hashlib.sha256(evidence.encode()).hexdigest()!=obs.get('providerEvidenceSha256') or 'usage limit' not in evidence.lower() or 'try again at' not in evidence.lower(): fail('CODEX_CAPACITY_REUSE_PROVIDER_EVIDENCE_INVALID')
    source_path=wsl_path(obs.get('sourceReceiptPath'))
    if not source_path or not os.path.isfile(source_path): fail('CODEX_CAPACITY_REUSE_SOURCE_RECEIPT_MISSING')
    try: source=json.load(open(source_path,encoding='utf-8-sig'))
    except Exception as e: fail('CODEX_CAPACITY_REUSE_SOURCE_RECEIPT_INVALID:'+str(e))
    if digest(source)!=obs.get('sourceReceiptHash') or source.get('schemaVersion')!=1 or source.get('kind')!='PINO_CODEX_FALLBACK_ELIGIBILITY' or source.get('exitClass')!='CAPACITY_EXHAUSTED' or source.get('allAuthenticatedProfilesExhausted') is not True: fail('CODEX_CAPACITY_REUSE_SOURCE_RECEIPT_BINDING_INVALID')
    source_candidate=str(obs.get('sourceCandidate') or source.get('candidate') or '').lower()
    if not re.fullmatch(r'[0-9a-f]{40}',source_candidate) or source_candidate!=str(t.get('git_sha') or '').lower() or str(source.get('candidate') or '').lower()!=source_candidate: fail('CODEX_CAPACITY_REUSE_SOURCE_CANDIDATE_INVALID')
    if str(source.get('codexSourceThreadId') or '')!=a.thread or str(source.get('codexSourceReceiptSha256') or '')!=str(a.expected_hash or ''): fail('CODEX_CAPACITY_REUSE_SOURCE_THREAD_BINDING_INVALID')
    return obs,source,source_candidate
def codex_capacity(a):
    s,h,t,turns=codex_thread(a.thread); reuse=str(t.get('git_sha') or '').lower()!=str(a.candidate or '').lower()
    if reuse:
        obs,source,source_candidate=active_capacity_reuse(a,t); validate_codex_common(t,source_candidate); source_risk_hash,source_risk_families=codex_risk_binding(t,argparse.Namespace(risk_hash=None,risk_families_json=None))
    else:
        source_candidate=a.candidate; validate_codex_common(t,a.candidate); source_risk_hash,source_risk_families=codex_risk_binding(t,a)
    failed=[x for x in turns if x.get('status')=='failed']
    if len(failed)!=1: fail('CODEX_CAPACITY_FAILED_TURN_COUNT_INVALID')
    turn=failed[0]
    try: err=json.loads(turn.get('error_json') or '{}')
    except Exception: fail('CODEX_CAPACITY_ERROR_JSON_INVALID')
    if err.get('codexErrorInfo')!='usageLimitExceeded': fail('CODEX_CAPACITY_EXIT_NOT_AUTHENTICATED')
    selected={'kind':'CODEX_THREAD_CAPACITY_V1','threadId':a.thread,'candidate':source_candidate,'riskContractHash':source_risk_hash,'requiredRiskFamilies':source_risk_families,'thread':{k:t.get(k) for k in ('source','model_provider','cwd','sandbox_policy','approval_mode','git_sha','git_origin_url','cli_version','model')},'turn':{k:turn.get(k) for k in ('turn_id','status','error_json','started_at','completed_at')}}
    hsh=digest(selected)
    if a.expected_hash and hsh!=a.expected_hash: fail('CODEX_CAPACITY_SOURCE_HASH_MISMATCH')
    if reuse:
        if not re.fullmatch(r'[0-9a-f]{64}',str(a.risk_hash or '')): fail('CODEX_CAPACITY_REUSE_CURRENT_RISK_HASH_INVALID')
        try: risk_families=json.loads(a.risk_families_json or 'null')
        except Exception as e: fail('CODEX_CAPACITY_REUSE_CURRENT_RISK_FAMILIES_INVALID:'+str(e))
        if not isinstance(risk_families,list) or any(not isinstance(x,str) for x in risk_families): fail('CODEX_CAPACITY_REUSE_CURRENT_RISK_FAMILIES_INVALID')
        risk_hash=a.risk_hash
    else:
        risk_hash=source_risk_hash;risk_families=source_risk_families
    print(json.dumps({'ok':True,'kind':'CODEX_THREAD_CAPACITY_V1','sourceReceiptSha256':hsh,'threadId':a.thread,'riskContractHash':risk_hash,'requiredRiskFamilies':risk_families,'capacityEvidenceReused':reuse},separators=(',',':')))
def pac_action(action_id):
    if not os.path.isfile(PAC_TOKEN): fail('PAC_TOKEN_MISSING')
    token=open(PAC_TOKEN,encoding='utf-8').read().strip()
    p=subprocess.run([CURL_EXE,'-fsS','-H','Authorization: Bearer '+token,PAC_GATEWAY+'/v1/actions/'+action_id],capture_output=True,text=True)
    if p.returncode: fail('PAC_ACTION_FETCH_FAILED:'+p.stderr.strip())
    try:return json.loads(p.stdout)
    except Exception as e:fail('PAC_ACTION_JSON_INVALID:'+str(e))
def chatgpt(a):
    expected=decode_json_b64(a.result_b64); x=pac_action(a.action_id); action=x.get('action') or {}; dispatch=x.get('dispatch') or {}; receipt=x.get('receipt') or {}
    if not a.prompt_file or not os.path.isfile(a.prompt_file): fail('CHATGPT_SOURCE_PROMPT_ARTIFACT_MISSING')
    prompt=open(a.prompt_file,encoding='utf-8-sig').read(); prompt_hash=audit_identity_sha(prompt)
    if prompt_hash!=a.prompt_sha: fail('CHATGPT_SOURCE_PROMPT_ARTIFACT_HASH_MISMATCH')
    risk_hash,risk_families=risk_binding_prompt(prompt,a)
    if action.get('action_id')!=a.action_id or action.get('action_type')!='chatgpt.audit.status' or action.get('state')!='CONFIRMED': fail('CHATGPT_SOURCE_ACTION_INVALID')
    if receipt.get('receipt_id')!=a.receipt_id or receipt.get('outcome')!='CONFIRMED': fail('CHATGPT_SOURCE_RECEIPT_INVALID')
    ej=str(receipt.get('evidence_json') or '')
    eh=hashlib.sha256(ej.encode()).hexdigest()
    if eh!=a.evidence_hash: fail('CHATGPT_SOURCE_EVIDENCE_HASH_MISMATCH')
    try:e=json.loads(ej); target=json.loads(action.get('target_json') or '{}'); payload=json.loads(dispatch.get('payload_json') or '{}')
    except Exception as ex:fail('CHATGPT_SOURCE_BINDING_JSON_INVALID:'+str(ex))
    if e.get('operation')!='CHATGPT_AUDIT_STATUS' or e.get('terminal') is not True or e.get('candidate')!=a.candidate or e.get('conversationId')!=a.conversation_id or e.get('promptSha256')!=a.prompt_sha: fail('CHATGPT_SOURCE_TERMINAL_BINDING_INVALID')
    if target.get('reviewKey')!=a.review_key or payload.get('reviewKey')!=a.review_key or payload.get('candidate')!=a.candidate or payload.get('conversationId')!=a.conversation_id or payload.get('promptSha256')!=a.prompt_sha: fail('CHATGPT_SOURCE_DISPATCH_BINDING_INVALID')
    if stable(e.get('auditResult'))!=stable(expected): fail('CHATGPT_SOURCE_RESULT_MISMATCH')
    selected={'kind':'PAC_ACTION_RECEIPT_V1','actionId':a.action_id,'receiptId':a.receipt_id,'evidenceSha256':eh,'candidate':a.candidate,'conversationId':a.conversation_id,'promptSha256':a.prompt_sha,'reviewKey':a.review_key,'riskContractHash':risk_hash,'requiredRiskFamilies':risk_families,'result':e.get('auditResult')}
    hsh=digest(selected)
    if a.expected_hash and hsh!=a.expected_hash: fail('CHATGPT_SOURCE_RECEIPT_HASH_MISMATCH')
    print(json.dumps({'ok':True,'kind':'PAC_ACTION_RECEIPT_V1','sourceReceiptSha256':hsh,'actionId':a.action_id,'receiptId':a.receipt_id,'riskContractHash':risk_hash,'requiredRiskFamilies':risk_families},separators=(',',':')))

p=argparse.ArgumentParser(); sub=p.add_subparsers(dest='mode',required=True)
c=sub.add_parser('codex'); c.add_argument('--thread',required=True); c.add_argument('--candidate',required=True); c.add_argument('--repository',required=True); c.add_argument('--pr',type=int,required=True); c.add_argument('--review-kind',required=True); c.add_argument('--result-b64',required=True); c.add_argument('--risk-hash'); c.add_argument('--risk-families-json')
k=sub.add_parser('codex-capacity'); k.add_argument('--thread',required=True); k.add_argument('--candidate',required=True); k.add_argument('--expected-hash'); k.add_argument('--risk-hash'); k.add_argument('--risk-families-json')
g=sub.add_parser('chatgpt'); g.add_argument('--action-id',required=True); g.add_argument('--receipt-id',required=True); g.add_argument('--evidence-hash',required=True); g.add_argument('--candidate',required=True); g.add_argument('--conversation-id',required=True); g.add_argument('--prompt-sha',required=True); g.add_argument('--review-key',required=True); g.add_argument('--result-b64',required=True); g.add_argument('--expected-hash'); g.add_argument('--prompt-file',required=True); g.add_argument('--risk-hash'); g.add_argument('--risk-families-json')
a=p.parse_args(); {'codex':codex_direct,'codex-capacity':codex_capacity,'chatgpt':chatgpt}[a.mode](a)
