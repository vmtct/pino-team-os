import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

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

export function assessFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 40) return { ok: false, reason: 'file count outside 1..40' };
  const rejected = [];
  for (const file of files) {
    if (!safeUiPath(file.filename) || (file.previous_filename && !safeUiPath(file.previous_filename))) rejected.push(file.filename);
  }
  return rejected.length ? { ok: false, reason: 'requires manual merge: ' + rejected.slice(0, 6).join(', ') } : { ok: true };
}

const DENY_LABELS = new Set(['manual-merge', 'no-auto-merge', 'merge-hold', 'release-hold', 'founder-review', 'security-review', 'migration', 'production']);
export function assessPR(pr, policyAt, repo = 'vmtct/pino-team-os') {
  if (!pr || pr.state !== 'open' || pr.draft || pr.base?.ref !== 'main' || pr.head?.repo?.full_name !== repo || pr.user?.login !== 'vmtct') return 'untrusted, closed or draft PR';
  if (!(new Date(pr.created_at).getTime() >= new Date(policyAt).getTime())) return 'pre-existing PR: manual disposition';
  if (pr.auto_merge) return 'native auto-merge already enabled';
  if (pr.labels?.some(l => DENY_LABELS.has(l.name.toLowerCase()))) return 'manual/release hold label';
  if (pr.requested_reviewers?.length || pr.requested_teams?.length) return 'review requested';
  if (/^\s*(DO_NOT_MERGE|MERGE_HOLD|STOP_BEFORE_MERGE)\b/im.test(pr.body || '')) return 'explicit PR merge hold';
  if (['dirty', 'blocked'].includes(pr.mergeable_state)) return 'merge conflict or blocked';
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
  const number = event.pull_request?.number;
  if (!Number.isInteger(number)) return;
  const protection = await api('/repos/' + repo + '/branches/main/protection');
  const status = protection.required_status_checks;
  const contexts = [...(status?.contexts || []), ...(status?.checks || []).map(x => x.context)];
  if (!status?.strict || !contexts.includes('validate') || !protection.required_pull_request_reviews) {
    console.log('HOLD: exact-head PR Validation and protected PR merge requirements missing');
    return;
  }
  const commit = await api('/repos/' + repo + '/commits?path=.github/workflows/guarded-ui-automerge.yml&per_page=1');
  if (!commit?.[0]?.commit?.committer?.date) throw new Error('No automation activation timestamp');
  const pr = await api('/repos/' + repo + '/pulls/' + number);
  const hold = assessPR(pr, commit[0].commit.committer.date, repo);
  const files = pr.state === 'open' ? await changedFiles(repo, number) : [];
  const assessment = assessFiles(files);
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
  if (data.errors?.length || !data.data?.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest) {
    throw new Error('Native auto-merge not admitted: ' + JSON.stringify(data.errors || data));
  }
  console.log('ENABLED_NATIVE_AUTO_MERGE PR #' + number + ' HEAD ' + pr.head.sha + ' files=' + files.length + ' (CI and branch rules still mandatory)');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch(e => { console.error(e); process.exitCode = 1; });
}
