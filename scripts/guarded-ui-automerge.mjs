import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { assessApplicationFiles } from './guarded-app-automerge-policy.mjs';

// Fail closed: a green CI run is necessary but not sufficient for automatic admission.
export function safeUiPath(input) {
  if (typeof input !== 'string' || input.includes('\\') || input.includes('..') || !/^[A-Za-z0-9_./-]+$/.test(input)) return false;
  const p = input.toLowerCase();
  if (/(^|\/)(api|auth|access|acl|permission|security|session|login|logout|role|roles|user|users|payment|payments|secret|secrets|production|deploy|release|migration|worker|wrangler)(\/|\.|-)/.test(p)) return false;
  if (/^docs\/automation\/guarded-automerge-smoke-[a-z0-9-]+\.md$/.test(p)) return true;
  if (/^public\/(bo|tos|ho|pino)\/[a-z0-9_./-]+\.(png|jpg|jpeg|webp|avif)$/.test(p)) return true;
  if (/^app\/(bo|tos|ho)\/[a-z0-9_./-]+\.module\.css$/.test(p)) return true;
  if (/^app\/(bo|tos|ho)\/[a-z0-9_./-]+\.css$/.test(p)) return true;
  if (/^app\/(bo|tos|ho)\/(components|ui|views)\/[a-z0-9_./-]+\.(tsx|test\.ts|test\.tsx)$/.test(p)) return true;
  if (/^app\/(bo|tos|ho)\/([a-z0-9_-]+\/)*page\.tsx$/.test(p)) return true;
  return false;
}

export function assessFiles(files, context = {}) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 40)
    return { ok: false, reason: 'file count outside 1..40' };
  // UI-only path remains unchanged; policy/architecture expansion is a distinct,
  // test-backed, exact-scope lane. Never checkout executable PR code here.
  if (files.every(file => safeUiPath(file.filename) &&
      !file.previous_filename && !['removed', 'renamed'].includes(file.status)))
    return { ok: true, lane: 'ui' };
  const app = assessApplicationFiles(files, context, safeUiPath);
  if (app.ok) return app;
  return { ok: false, reason: 'requires manual merge: ' + app.reason };
}

const DENY_LABELS = new Set(['manual-merge', 'no-auto-merge', 'merge-hold', 'release-hold', 'founder-review', 'security-review', 'migration', 'production']);
// Keep original UI eligibility epoch stable across changes to the workflow file;
// new application scopes become eligible only after the updated policy is merged.
// The PINNED PAP-1089 lane uses an immutable PR/HEAD/files tuple instead of age.
export function policyEpochForLane(lane, latestWorkflowCommitAt) {
  if (lane === 'ui') return '2026-10-27T00:21:29Z';
  if (lane === 'pinned-pap1089') return '1970-01-01T00:00:00Z';
  return latestWorkflowCommitAt;
}
export function verifiedGreenPRRun(run, repo) {
  return !!run && run.event === 'pull_request' &&
    run.conclusion === 'success' &&
    run.path === '.github/workflows/pr-validation.yml' &&
    run.head_repository?.full_name === repo &&
    typeof run.head_sha === 'string' && /^[0-9a-f]{40}$/.test(run.head_sha);
}
export function pendingGithubMergeStatus(result) {
  return result?.errors?.some(e =>
    e.type === 'UNPROCESSABLE' && /unstable status/i.test(e.message)) === true;
}
export function assessPR(pr, policyAt, repo = 'vmtct/pino-team-os') {
  if (!pr || pr.state !== 'open' || pr.draft || pr.base?.ref !== 'main' || pr.head?.repo?.full_name !== repo || pr.user?.login !== 'vmtct') return 'untrusted, closed or draft PR';
  if (!(new Date(pr.created_at).getTime() >= new Date(policyAt).getTime())) return 'pre-existing PR: manual disposition';
  // Already-enabled native merge is valid state, not a HOLD reason. Revocation
  // is reserved for a *separate* real policy violation (labels, paths, etc.).
  if (pr.labels?.some(l => DENY_LABELS.has(l.name.toLowerCase()))) return 'manual/release hold label';
  if (pr.requested_reviewers?.length || pr.requested_teams?.length) return 'review requested';
  if (/^\s*(DO_NOT_MERGE|MERGE_HOLD|STOP_BEFORE_MERGE)\b/im.test(pr.body || '')) return 'explicit PR merge hold';
  if (pr.mergeable_state === 'dirty') return 'merge conflict';
  return null;
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'pino-guarded-ui-automerge'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const content = await response.text();
  if (!response.ok) throw new Error(method + ' ' + path + ': HTTP ' + response.status + ' ' + content.slice(0, 300));
  return JSON.parse(content);
}

async function changedFiles(repo, number) {
  const result = [];
  for (let page = 1; page <= 2; page++) {
    const part = await api('/repos/' + repo + '/pulls/' + number + '/files?per_page=100&page=' + page);
    result.push(...part);
    if (part.length < 100) return result;
  }
  throw new Error('File pagination exceeded safe bound');
}

async function hasRequestedChanges(repo, number) {
  const reviews = await api('/repos/' + repo + '/pulls/' + number + '/reviews?per_page=100');
  if (reviews.length === 100) return true; // fail closed on pagination ambiguity
  const latest = new Map();
  for (const review of reviews) if (review.user?.login && review.state !== 'PENDING') latest.set(review.user.login, review.state);
  return [...latest.values()].includes('CHANGES_REQUESTED');
}

async function run() {
  const repo = process.env.GITHUB_REPOSITORY;
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (repo !== 'vmtct/pino-team-os' || event.action === 'closed') return;
  // Successful PR CI is a second admission trigger: a new PR can be temporarily
  // unstable while checks settle. Resolve by CI-tested SHA, never PR body.
  let number = event.pull_request?.number;
  let validatedHead = null;
  if (event.workflow_run) {
    const run = event.workflow_run;
    if (!verifiedGreenPRRun(run, repo)) return;
    const associated = await api('/repos/' + repo + '/commits/' + run.head_sha + '/pulls?per_page=100');
    const matches = associated.filter(pr =>
      pr.base?.ref === 'main' && pr.head?.sha === run.head_sha &&
      pr.head?.repo?.full_name === repo && pr.user?.login === 'vmtct');
    if (matches.length !== 1) {console.log('HOLD: CI head does not map to one founder main PR'); return;}
    number = matches[0].number;
    validatedHead = run.head_sha;
  }
  if (!Number.isInteger(number)) return;
  const branch = await api('/repos/' + repo + '/branches/main');
  const settings = await api('/repos/' + repo);
  console.log('Admission preflight: protected=' + String(branch.protected) + ', repositoryAutoMergeVisible=' + String(settings.allow_auto_merge));
  if (!branch.protected || settings.allow_auto_merge !== true ||
      !branch.protection?.required_status_checks?.contexts?.includes('validate')) {
    console.log('HOLD: protected main, required validate check or native auto-merge unavailable');
    return;
  }
  const commit = await api('/repos/' + repo + '/commits?path=.github/workflows/guarded-ui-automerge.yml&per_page=1');
  if (!commit?.[0]?.commit?.committer?.date) throw new Error('No automation activation timestamp');
  const pr = await api('/repos/' + repo + '/pulls/' + number);
  const files = pr.state === 'open' ? await changedFiles(repo, number) : [];
  const assessment = assessFiles(files, { prNumber: number, headSha: pr.head?.sha });
  const policyEpoch = policyEpochForLane(assessment.lane, commit[0].commit.committer.date);
  const hold = assessPR(pr, policyEpoch, repo);
  const requestedChanges = pr.state === 'open' ? await hasRequestedChanges(repo, number) : false;
  const reason = hold || (!assessment.ok ? assessment.reason : null) || (requestedChanges ? 'changes requested' : null);
  if (reason) {
    // A later synchronize, label or review can invalidate an earlier admission.
    // Revoke native auto-merge rather than merely skipping this event.
    if (pr.auto_merge) {
      const revoked = await api('/graphql', {
        method: 'POST',
        body: {
          query: 'mutation($id: ID!) { disablePullRequestAutoMerge(input: { pullRequestId: $id }) { pullRequest { number autoMergeRequest { enabledAt } } } }',
          variables: { id: pr.node_id }
        }
      });
      if (revoked.errors?.length) throw new Error('Could not revoke unsafe auto-merge: ' + JSON.stringify(revoked.errors));
      console.log('REVOKED_NATIVE_AUTO_MERGE PR #' + number + ': ' + reason);
    } else console.log('HOLD PR #' + number + ': ' + reason);
    return;
  }
  if (pr.auto_merge) { console.log('Native auto-merge already enabled for PR #' + number); return; }

  // GitHub-native auto-merge is enabled before CI succeeds. The actual merge is
  // performed by GitHub after protected branch checks, allowing main push CI/CD.
  const data = await api('/graphql', {
    method: 'POST',
    body: {
      query: 'mutation($id: ID!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: SQUASH }) { pullRequest { number autoMergeRequest { enabledAt } } } }',
      variables: { id: pr.node_id }
    }
  });
  if (pendingGithubMergeStatus(data)) {
    // Never turn a temporary GitHub mergeability status into a failing "admit"
    // check: that failure itself would keep the PR unstable (self-deadlock).
    console.log('HOLD_STATUS_UNSTABLE PR #' + number + ': CI/status checks not yet mergeable');
    return;
  }
  if (data.errors?.length || !data.data?.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest) {
    throw new Error('Native auto-merge not admitted: ' + JSON.stringify(data.errors || data));
  }
  console.log('ENABLED_NATIVE_AUTO_MERGE PR #' + number + ' HEAD ' + pr.head.sha + ' files=' + files.length + ' lane=' + assessment.lane + ' (CI and branch rules still mandatory)');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch(e => { console.error(e); process.exitCode = 1; });
}
