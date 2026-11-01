import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import postcss from 'postcss';
export const scope = 'html[data-bo-ui-authority="v25"]';
export function scopeAuthority(css) {
  const root = postcss.parse(css);
  root.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    const hides = rule.nodes.some(node => node.type === 'decl' && node.prop === 'display' && node.value.trim() === 'none');
    const freezeControl = /^#(?:undo-v22|redo-v22|filter-toggle|visible-columns|reset-all|group-shortcut|save-view)$/;
    rule.selectors = rule.selectors.flatMap(original => {
      // PAP-1105: preserve historical legacy hides, but do not disable Freeze's
      // existing settings/reset/undo controls in the opted-in shared renderer.
      const selector = hides && freezeControl.test(original)
        ? original + ':where(:not([data-tdd-freeze-controls] *))' : original;
      if (selector === '*') return ['*:where(' + scope + ')', ':where(' + scope + ') *'];
      if (/^:root(?=[\s:.#>+~\[]|$)/.test(selector)) return [selector.replace(':root', ':root:where([data-bo-ui-authority="v25"])')];
      if (/^html(?=[\s:.#>+~\[]|$)/.test(selector)) return [selector.replace(/^html/, scope.replace('[', ':where([') + ')')];
      return [':where(' + scope + ') ' + selector];
    });
  });
  return root.toString();
}
const base = 'public/bo-authority-source/';
const manifest = JSON.parse(readFileSync(base + 'manifest.json', 'utf8'));
for (const [file, digest] of Object.entries(manifest.files)) assert.equal(createHash('sha256').update(readFileSync(base + file)).digest('hex'), digest, file);
// The historical BO authority is hash-pinned. Append separately-reviewed shared TDD CSS.
const css = scopeAuthority(readFileSync(base + 'styles.css', 'utf8')) + '\n' +
  scopeAuthority(readFileSync('app/components/workspace-renderer/tdd-freeze.css', 'utf8'));
if (process.argv.includes('--check')) assert.equal(readFileSync(base + 'bo-scoped.css', 'utf8'), css);
else writeFileSync(base + 'bo-scoped.css', css);
console.log('PAP-1022 authority bytes and deterministic BO scope verified');
