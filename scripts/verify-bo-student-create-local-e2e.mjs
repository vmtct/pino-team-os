// PAP-1024: local browser contract for the authorized Student Intake UI. All API responses are fixtures.
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as fixture from './fixtures/bo-react-api.mjs';

const root = resolve('public/bo-authority-source');
const output = resolve(process.env.PAP1024_EVIDENCE || '.next/pap1024-e2e');
await mkdir(output, { recursive: true });
const bundle = (await build({ entryPoints: ['scripts/fixtures/bo-react-entry.tsx'], bundle: true, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false, define: { 'process.env.NODE_ENV': '"production"' } })).outputFiles[0].contents;
const studentId = '0198d050-56c1-7ac5-b9ab-b0e45d912345';
const parentId = '0198d050-56c1-7ac5-b9ab-b0e45d912346';
const guardianId = '0198d050-56c1-7ac5-b9ab-b0e45d912347';
const parent = { parent: { id: parentId, displayName: 'Nguyễn Phụ Huynh', status: 'ACTIVE', createdAt: '', updatedAt: '', version: 1 }, contacts: [{ id: guardianId, parentUserId: parentId, identifierType: 'PHONE', normalizedValue: '0901234567', isPrimary: true, verifiedAt: null, createdAt: '', retiredAt: null }] };
let authorized = true, postStatus = 200, includeCreated = false;
const posts = [], errors = [], checks = [];
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/runtime.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(bundle); return; }
    if (url.pathname === '/bo') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end('<!doctype html><html lang="vi" data-bo-ui-authority="v25"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bo-skeleton/styles.css"></head><body><div id="root"></div><script src="/runtime.js"></script></body></html>'); return; }
    if (url.pathname === '/bo-skeleton/styles.css') { response.writeHead(200, { 'content-type': 'text/css' }); response.end(await readFile(root + '/bo-scoped.css')); return; }
    if (url.pathname.startsWith('/api/bo/')) {
      const json = (status, value) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
      if (url.pathname === '/api/bo/context') { assert.equal(request.method, 'GET'); json(200, { data: { userId: parentId, email: 'operator@example.invalid', staffMemberId: null, displayName: 'BO Manager', staffProfile: null, surface: 'BO', entitled: true, permissionKeys: authorized ? ['student.profile.manage'] : [] } }); return; }
      if (url.pathname === '/api/bo/learners') { assert.equal(request.method, 'GET'); json(200, { data: [...fixture.students.slice(0, 3), ...(includeCreated ? [{ id: studentId, displayName: 'Student mới', birthYear: 2020, status: 'ACTIVE', houseMember: false, activePaths: [] }] : [])] }); return; }
      if (url.pathname === '/api/bo/identity/parents') { assert.equal(request.method, 'GET'); json(200, { data: [parent] }); return; }
      if (url.pathname === '/api/bo/student-intakes') {
        assert.equal(request.method, 'POST');
        const bytes = []; for await (const chunk of request) bytes.push(chunk);
        posts.push({ key: request.headers['idempotency-key'], body: JSON.parse(Buffer.concat(bytes).toString('utf8')) });
        if (postStatus !== 200) { json(postStatus, { error: { message: 'Lệnh chưa hoàn tất' } }); return; }
        includeCreated = true;
        json(200, { data: { studentProfileId: studentId, parentUserId: parentId, guardianRelationshipId: guardianId, parentReused: true } }); return;
      }
      throw Error('Unexpected API ' + url.pathname);
    }
    response.writeHead(404); response.end();
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PAP1024_BROWSER || 'chrome' });
try {
  for (const width of [390, 768, 1440]) {
    authorized = width !== 1440; includeCreated = false; postStatus = 200; posts.length = 0;
    const context = await browser.newContext({ viewport: { width, height: 950 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    await page.goto(origin + '/bo'); await page.locator('#table-body .row-open').first().waitFor();
    await page.locator('#add-record').waitFor(); // Existing BO behavior: Core decides command permission.
    await page.locator('#add-record').click(); await page.locator('#drawer.open').waitFor();
    const labels = await page.locator('#drawer .property-label').evaluateAll(nodes => nodes.map(node => [node.getBoundingClientRect().left, node.querySelector('small').getBoundingClientRect().left]));
    assert.ok(labels.every(([left, icon]) => Math.abs(left - labels[0][0]) < 1 && Math.abs(icon - labels[0][1]) < 1));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#drawer').screenshot({ path: output + `/student-create-${width}.png` });
    await page.getByRole('textbox', { name: 'Tên học viên' }).fill('Student mới');
    if (width === 390) {
      await page.getByRole('searchbox', { name: 'Tìm theo tên, SĐT hoặc email' }).fill('Nguyễn');
      const option = page.getByRole('button', { name: /Nguyễn Phụ Huynh/ }); await option.waitFor(); await option.click();
      await page.locator('#create-save').click();
      await page.locator('#drawer').waitFor({ state: 'detached' });
      assert.equal(posts.length, 1); assert.equal(posts[0].body.existingParentUserId, parentId);
      assert.equal(posts[0].body.displayName, 'Student mới');
      await page.locator('#table-body').getByText('Student mới').waitFor();
      assert.equal(await page.locator('#table-body').getByText('Student mới').count(), 1);
      checks.push({ width, mode: 'existing', permission: true, canonicalRefresh: true });
    } else if (width === 768) {
      await page.getByRole('button', { name: 'Tạo phụ huynh mới' }).click();
      await page.getByRole('textbox', { name: 'Tên phụ huynh / người giám hộ' }).fill('Phụ huynh mới');
      await page.getByRole('textbox', { name: 'Số điện thoại phụ huynh' }).fill('0901234568');
      postStatus = 500; await page.locator('#create-save').click();
      await page.getByText('Kết quả chưa xác định.').waitFor();
      assert.equal(await page.locator('#drawer-close').isDisabled(), true);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#drawer.open').count(), 1);
      postStatus = 200; await page.locator('#create-save').click(); await page.locator('#drawer').waitFor({ state: 'detached' });
      assert.equal(posts.length, 2); assert.deepEqual(posts[1], posts[0]);
      assert.equal(posts[0].body.guardianDisplayName, 'Phụ huynh mới');
      checks.push({ width, mode: 'new', replay: true, ambiguousCloseGuard: true });
    } else {
      await page.getByRole('button', { name: 'Tạo phụ huynh mới' }).click();
      await page.getByRole('textbox', { name: 'Số điện thoại phụ huynh' }).fill('0901234569');
      postStatus = 403; await page.locator('#create-save').click();
      await page.getByRole('button', { name: 'Sửa dữ liệu' }).waitFor();
      assert.equal(includeCreated, false); assert.equal(await page.locator('#drawer.open').count(), 1);
      await page.getByRole('button', { name: 'Sửa dữ liệu' }).click();
      assert.equal(await page.getByRole('textbox', { name: 'Tên học viên' }).isEnabled(), true);
      checks.push({ width, mode: 'denied', noFalseSuccess: true, terminalReset: true });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(output + '/receipt.json', JSON.stringify({ result: 'LOCAL_STUDENT_CREATE_E2E_PASS', jira: 'PAP-1024', checks, errors }, null, 2));
  console.log(JSON.stringify({ result: 'LOCAL_STUDENT_CREATE_E2E_PASS', checks }));
} catch (error) {
  process.exitCode = 1;
  throw error;
} finally {
  // Chromium can leave a Windows transport open after every context has closed.
  const watchdog = setTimeout(() => process.exit(process.exitCode || 0), 10000);
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  clearTimeout(watchdog);
}
