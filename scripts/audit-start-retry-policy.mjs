const DEFAULT_MAX_SAFE_START_RETRIES=1;

function safeNoWriteEvidence(evidence){
  const e=evidence??{};
  return String(e.reason??'')==='QUEUE_TTL_EXPIRED' && String(e.operation??'')==='SKIPPED' && e.writeAttempted===false;
}

function isSafeNoWriteStartResult(result){
  return String(result?.outcome??'')==='NOT_STARTED' && safeNoWriteEvidence(result?.evidence);
}

function isSafeNoWriteStartRecord(record){
  return String(record?.state??'')==='OUTCOME_UNKNOWN' && String(record?.outcome??'')==='NOT_STARTED' && safeNoWriteEvidence(record?.failure);
}

function safeStartRetryCount(record){
  return Number.isInteger(record?.safeStartRetryCount)&&record.safeStartRetryCount>=0?record.safeStartRetryCount:0;
}

function canSafeRetryStart(record,maxRetries=DEFAULT_MAX_SAFE_START_RETRIES){
  return isSafeNoWriteStartRecord(record) && safeStartRetryCount(record)<maxRetries;
}

function retryIdempotencyKey(reviewKey,retryCount=0){
  const n=Number(retryCount)||0;
  return n>0?`chatgpt-audit/start/${reviewKey}/safe-retry-${n}`:`chatgpt-audit/start/${reviewKey}`;
}

export{DEFAULT_MAX_SAFE_START_RETRIES,safeNoWriteEvidence,isSafeNoWriteStartResult,isSafeNoWriteStartRecord,safeStartRetryCount,canSafeRetryStart,retryIdempotencyKey};
