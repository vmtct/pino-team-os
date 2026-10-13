#!/usr/bin/env python3
import argparse,hashlib,json,os,re,secrets,sys,time,uuid
ROOT=os.environ.get('PINO_REVIEW_OBLIGATION_DIR','/mnt/c/Users/ADMIN/Documents/PINO_SOP/state/review-obligations')
LOCKS=os.path.join(ROOT,'.locks')

def stable(v):
    if isinstance(v,dict):return {k:stable(v[k]) for k in sorted(v)}
    if isinstance(v,list):return [stable(x) for x in v]
    return v
def digest(v):return hashlib.sha256(json.dumps(stable(v),separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def fail(m,code=42):print('ERROR: '+m,file=sys.stderr);raise SystemExit(code)
def norm_vector(raw,repo,pr,candidate):
    if raw:
        try:rows=json.loads(raw)
        except Exception as e:fail('OBLIGATION_VECTOR_JSON_INVALID:'+str(e))
    else:rows=[{'repository':repo,'prNumber':pr,'candidate':candidate}]
    out=[]
    for r in rows:
        rr=str(r.get('repository') or r.get('repo') or '').strip().lower(); pp=int(r.get('prNumber') or r.get('pr') or 0); cc=str(r.get('candidate') or r.get('headSha') or '').strip().lower()
        if rr.count('/')!=1 or pp<1 or not re.fullmatch(r'[0-9a-f]{40}',cc):fail('OBLIGATION_VECTOR_BINDING_INVALID')
        out.append({'repository':rr,'prNumber':pp,'candidate':cc})
    out.sort(key=lambda x:(x['repository'],x['prNumber']))
    primary={'repository':repo.lower(),'prNumber':int(pr),'candidate':candidate.lower()}
    if primary not in out:fail('OBLIGATION_PRIMARY_NOT_IN_VECTOR')
    return out,digest(out)
def key_for(kind,repo,pr,candidate,vector_hash,risk_hash):return hashlib.sha256(f'{kind}|{repo.lower()}|{int(pr)}|{candidate.lower()}|{vector_hash}|{risk_hash}'.encode()).hexdigest()
def paths(key):return os.path.join(ROOT,key+'.json'),os.path.join(LOCKS,key+'.lock')
def acquire(key,timeout=None):
    if timeout is None: timeout=float(os.environ.get('PINO_REVIEW_LOCK_TIMEOUT_SECONDS','15'))
    os.makedirs(ROOT,exist_ok=True);os.makedirs(LOCKS,exist_ok=True);_,lp=paths(key);token=uuid.uuid4().hex;deadline=time.time()+timeout
    while True:
        try:
            fd=os.open(lp,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.write(fd,json.dumps({'token':token,'pid':os.getpid(),'createdAt':time.time()}).encode());os.close(fd);return token,lp
        except FileExistsError:
            if time.time()>deadline:fail('OBLIGATION_MUTATION_LOCK_TIMEOUT:'+lp)
            time.sleep(.05)
def owns(lp,token):
    try:return json.load(open(lp,encoding='utf-8')).get('token')==token
    except Exception:return False
def release(lp,token):
    if owns(lp,token):
        try:os.unlink(lp)
        except FileNotFoundError:pass
def read_claim(cp):
    if not os.path.isfile(cp):return None
    try:return json.load(open(cp,encoding='utf-8-sig'))
    except Exception as e:fail('OBLIGATION_CLAIM_JSON_INVALID:'+str(e))
def write_claim(cp,claim,lp,token):
    if not owns(lp,token):fail('OBLIGATION_FENCE_LOST_BEFORE_COMMIT')
    tmp=cp+'.tmp-'+str(os.getpid())+'-'+uuid.uuid4().hex
    with open(tmp,'w',encoding='utf-8') as f:json.dump(claim,f,ensure_ascii=False,indent=2);f.write('\n')
    if not owns(lp,token):
        try:os.unlink(tmp)
        except FileNotFoundError:pass
        fail('OBLIGATION_FENCE_LOST_BEFORE_RENAME')
    os.replace(tmp,cp)
def args_binding(a):
    vector,vh=norm_vector(getattr(a,'vector_json',None),a.repository,a.pr,a.candidate)
    if not re.fullmatch(r'[0-9a-f]{64}',a.risk_hash):fail('OBLIGATION_RISK_HASH_INVALID')
    return vector,vh,key_for(a.review_kind,a.repository,a.pr,a.candidate,vh,a.risk_hash)
def claim_codex(a):
    vector,vh,key=args_binding(a);cp,_=paths(key);lt,lp=acquire(key)
    try:
        if read_claim(cp):fail('OBLIGATION_ALREADY_CLAIMED:'+key)
        owner=secrets.token_hex(32);claim={'schemaVersion':1,'kind':'PINO_REVIEW_OBLIGATION','obligationKey':key,'state':'CODEX_INFLIGHT','reviewKind':a.review_kind,'repository':a.repository.lower(),'prNumber':a.pr,'candidate':a.candidate.lower(),'candidateVector':vector,'candidateVectorHash':vh,'riskContractHash':a.risk_hash,'codexTokenHash':hashlib.sha256(owner.encode()).hexdigest(),'createdAt':time.time()};write_claim(cp,claim,lp,lt)
        print(json.dumps({'ok':True,'obligationKey':key,'claimPath':cp,'token':owner,'state':'CODEX_INFLIGHT','candidateVectorHash':vh},separators=(',',':')))
    finally:release(lp,lt)
def codex_capacity(a):
    cp,_=paths(a.key);lt,lp=acquire(a.key)
    try:
        c=read_claim(cp)
        if not c or c.get('state')!='CODEX_INFLIGHT' or hashlib.sha256(a.token.encode()).hexdigest()!=c.get('codexTokenHash'):fail('OBLIGATION_CODEX_TOKEN_OR_STATE_INVALID')
        c.update({'state':'CODEX_CAPACITY','codexCapacitySourceThreadId':a.source_thread,'codexCapacitySourceReceiptSha256':a.source_hash,'capacityReceiptSha256':a.capacity_receipt_hash,'capacityAt':time.time()});write_claim(cp,c,lp,lt);print(json.dumps({'ok':True,'obligationKey':a.key,'state':'CODEX_CAPACITY'},separators=(',',':')))
    finally:release(lp,lt)
def claim_chatgpt(a):
    vector,vh,key=args_binding(a);cp,_=paths(key);lt,lp=acquire(key)
    try:
        c=read_claim(cp)
        if not c or c.get('state')!='CODEX_CAPACITY':fail('OBLIGATION_CHATGPT_REQUIRES_CODEX_CAPACITY')
        if c.get('candidateVectorHash')!=vh or c.get('riskContractHash')!=a.risk_hash or c.get('capacityReceiptSha256')!=a.capacity_receipt_hash:fail('OBLIGATION_CHATGPT_CAPACITY_BINDING_MISMATCH')
        owner=secrets.token_hex(32);c.update({'state':'CHATGPT_INFLIGHT','chatgptTokenHash':hashlib.sha256(owner.encode()).hexdigest(),'chatgptLabel':a.label,'chatgptAt':time.time()});write_claim(cp,c,lp,lt);print(json.dumps({'ok':True,'obligationKey':key,'claimPath':cp,'token':owner,'state':'CHATGPT_INFLIGHT'},separators=(',',':')))
    finally:release(lp,lt)
def terminal(a):
    cp,_=paths(a.key);lt,lp=acquire(a.key)
    try:
        c=read_claim(cp)
        if not c:fail('OBLIGATION_TERMINAL_CLAIM_MISSING')
        if c.get('state')=='TERMINAL':
            if c.get('terminalProvider')==a.provider and c.get('terminalVerdict')==a.verdict:print(json.dumps({'ok':True,'idempotent':True,'obligationKey':a.key,'state':'TERMINAL'},separators=(',',':')));return
            fail('OBLIGATION_TERMINAL_CONFLICT')
        expected_state='CODEX_INFLIGHT' if a.provider=='CODEX' else 'CHATGPT_INFLIGHT';field='codexTokenHash' if a.provider=='CODEX' else 'chatgptTokenHash'
        if c.get('state')!=expected_state or hashlib.sha256(a.token.encode()).hexdigest()!=c.get(field):fail('OBLIGATION_TERMINAL_TOKEN_OR_STATE_INVALID')
        c.update({'state':'TERMINAL','terminalProvider':a.provider,'terminalVerdict':a.verdict,'terminalAuthorityEvidenceHash':a.authority_hash,'terminalAt':time.time()});write_claim(cp,c,lp,lt);print(json.dumps({'ok':True,'obligationKey':a.key,'state':'TERMINAL'},separators=(',',':')))
    finally:release(lp,lt)
def inspect(a):
    cp,_=paths(a.key);c=read_claim(cp)
    if not c:fail('OBLIGATION_NOT_FOUND')
    print(json.dumps(c,separators=(',',':')))
def abort_prestart(a):
    if not re.fullmatch(r'[0-9a-f]{64}',a.key):fail('OBLIGATION_ABORT_KEY_INVALID')
    if not re.fullmatch(r'[0-9a-f]{40}',a.candidate):fail('OBLIGATION_ABORT_CANDIDATE_INVALID')
    if not re.fullmatch(r'[0-9a-f]{64}',a.risk_hash):fail('OBLIGATION_ABORT_RISK_HASH_INVALID')
    if not re.fullmatch(r'[0-9a-f]{64}',a.reason_hash):fail('OBLIGATION_ABORT_REASON_HASH_INVALID')
    cp,_=paths(a.key);lt,lp=acquire(a.key)
    try:
        c=read_claim(cp)
        if not c:
            prefix=a.key+'.aborted-prestart-'
            for name in sorted(os.listdir(ROOT),reverse=True):
                if not (name.startswith(prefix) and name.endswith('.json')):continue
                archived=read_claim(os.path.join(ROOT,name))
                if archived and archived.get('state')=='ABORTED_PRESTART' and archived.get('abortReasonHash')==a.reason_hash:
                    print(json.dumps({'ok':True,'idempotent':True,'obligationKey':a.key,'state':'ABORTED_PRESTART','archivePath':os.path.join(ROOT,name)},separators=(',',':')));return
            fail('OBLIGATION_ABORT_CLAIM_MISSING')
        if c.get('state')!='CODEX_INFLIGHT':fail('OBLIGATION_ABORT_STATE_INVALID:'+str(c.get('state')))
        if str(c.get('candidate') or '').lower()!=a.candidate.lower():fail('OBLIGATION_ABORT_CANDIDATE_MISMATCH')
        if str(c.get('riskContractHash') or '').lower()!=a.risk_hash.lower():fail('OBLIGATION_ABORT_RISK_HASH_MISMATCH')
        archived=dict(c);archived.update({'previousState':'CODEX_INFLIGHT','state':'ABORTED_PRESTART','abortReasonHash':a.reason_hash,'abortedAt':time.time()})
        ap=os.path.join(ROOT,a.key+'.aborted-prestart-'+uuid.uuid4().hex+'.json')
        write_claim(ap,archived,lp,lt)
        if not owns(lp,lt):fail('OBLIGATION_FENCE_LOST_BEFORE_ABORT_UNLINK')
        os.unlink(cp)
        print(json.dumps({'ok':True,'idempotent':False,'obligationKey':a.key,'state':'ABORTED_PRESTART','archivePath':ap},separators=(',',':')))
    finally:release(lp,lt)

p=argparse.ArgumentParser();sub=p.add_subparsers(dest='cmd',required=True)
def binding_parser(name):
    x=sub.add_parser(name);x.add_argument('--review-kind',required=True);x.add_argument('--repository',required=True);x.add_argument('--pr',type=int,required=True);x.add_argument('--candidate',required=True);x.add_argument('--risk-hash',required=True);x.add_argument('--vector-json');return x
c=binding_parser('claim-codex')
cc=sub.add_parser('codex-capacity');cc.add_argument('--key',required=True);cc.add_argument('--token',required=True);cc.add_argument('--source-thread',required=True);cc.add_argument('--source-hash',required=True);cc.add_argument('--capacity-receipt-hash',required=True)
g=binding_parser('claim-chatgpt');g.add_argument('--capacity-receipt-hash',required=True);g.add_argument('--label',required=True)
t=sub.add_parser('terminal');t.add_argument('--key',required=True);t.add_argument('--token',required=True);t.add_argument('--provider',choices=['CODEX','CHATGPT'],required=True);t.add_argument('--verdict',required=True);t.add_argument('--authority-hash',required=True)
i=sub.add_parser('inspect');i.add_argument('--key',required=True)
ab=sub.add_parser('abort-prestart');ab.add_argument('--key',required=True);ab.add_argument('--candidate',required=True);ab.add_argument('--risk-hash',required=True);ab.add_argument('--reason-hash',required=True)
a=p.parse_args();{'claim-codex':claim_codex,'codex-capacity':codex_capacity,'claim-chatgpt':claim_chatgpt,'terminal':terminal,'inspect':inspect,'abort-prestart':abort_prestart}[a.cmd](a)
