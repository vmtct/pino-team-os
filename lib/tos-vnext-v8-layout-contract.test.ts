import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const css = readFileSync(join(process.cwd(), 'app/components/tos-ds/components.module.css'), 'utf8');
const appCss = readFileSync(join(process.cwd(), 'app/components/tos-vnext/tos-vnext.module.css'), 'utf8');

test('PAP-934 V8 mobile viewport, app header and navigation boundaries', () => {
  assert.match(css, /\.mobile\{[^}]*max-width:430px/);
  assert.match(css, /\.header\{[^}]*height:60px/);
  assert.match(css, /\.nav\{[^}]*height:76px/);
  assert.match(css, /\.tab\{[^}]*min-height:44px/);
});

test('PAP-934 V8 tap targets, CTA and desktop Station boundaries', () => {
  assert.match(css, /\.button\{[^}]*min-height:48px/);
  assert.match(css, /\.home\{[^}]*min-height:44px/);
  assert.match(css, /\.desktop\{[^}]*max-width:none/);
  assert.match(appCss, /\.stationShell\{[^}]*grid-template-columns:/);
});
