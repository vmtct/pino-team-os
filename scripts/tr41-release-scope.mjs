/** TR-41: read-only scoped release admission inventory. Fails closed on nonpilot source. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SERVING_TEAM = '83a5c09df780f170e43d00c0ecea84afe1ca8738';
export const NON_PILOT = [
  /^app\/bo\/pinoria-tv-(?:dialogue|operator)\//,
  /^app\/pinoria-tv\//,
  /^lib\/pap657-/, /^lib\/pap659-/, /^lib\/f3-delivery-api\.ts$/,
];
export const APPROVED_PREFIX = [
  /^\.github\/workflows\/pr-validation\.yml$/,
  /^app\/bo\//,
  /^app\/components\/tos-shell\//,
  /^docs\/bo-v23-/,
  /^lib\/bo-/,
  /^lib\/running-class-weekly-teachers\.ts$/,
  /^scripts\/(?:verify-bo-|bo-route-import-guard|create-bo-module)/,
];
export function evaluate(paths, baselineRoutes, servingRoutes) {
  const nonpilot = paths.filter(p => NON_PILOT.some(re => re.test(p)));
  const uncategorized = paths.filter(p => !nonpilot.includes(p) && !APPROVED_PREFIX.some(re => re.test(p)));
  const baselineOnly = baselineRoutes.filter(p => !servingRoutes.includes(p));
  const servingOnly = servingRoutes.filter(p => !baselineRoutes.includes(p));
  const failures = [];
  if (nonpilot.length) failures.push(`NON_PILOT_FILES:${nonpilot.length}`);
  if (uncategorized.length) failures.push(`UNCLASSIFIED_FILES:${uncategorized.length}`);
  if (baselineOnly.length || servingOnly.length) failures.push(`BASELINE_SERVING_DRIFT:${baselineOnly.length}:${servingOnly.length}`);
  return { status: failures.length ? 'HOLD' : 'SCOPE_STATIC_PASS_NOT_RELEASE_ADMISSION', failures, nonpilot, uncategorized, baselineOnly, servingOnly, total: paths.length };
}
function git(root, ...args) {return execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();}
function main() {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidate=git(root, 'rev-parse','HEAD');
  const paths=git(root,'diff','--name-only',SERVING_TEAM,'HEAD').split(/\r?\n/).filter(Boolean);
  const baseline=JSON.parse(git(root,'show','HEAD:app/bo/architecture/legacy-baseline.json'));
  const servingRoutes=git(root,'ls-tree','-r','--name-only',SERVING_TEAM,'app/bo').split(/\r?\n/).filter(p=>p.endsWith('/page.tsx'));
  const assessment=evaluate(paths,baseline.legacyRoutes,servingRoutes);
  console.log(JSON.stringify({servingTeam:SERVING_TEAM,candidate, ...assessment},null,2));
  if(assessment.failures.length)process.exitCode=1;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
