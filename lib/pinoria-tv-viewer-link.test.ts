/** PAP-1646 / Epic PAP-650 PNR-TV — F1 stable Viewer link, no ACL bypass. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatTvPolicyViewerPath,
  isStableTvPolicyRef,
  parseTvPolicyViewerPath,
} from "./pinoria-tv-viewer-link";

const center = "0199ce43-781b-7e14-8a72-836a2925f8a8";
const centerRef = `tvp1-center-${center}`;

test("PAP-1646 builds stable single-template URLs for DEFAULT and one Center", () => {
  for (const ref of ["tvp1-default", centerRef]) {
    assert.equal(formatTvPolicyViewerPath(ref), `/tv/p/${ref}`);
    assert.equal(parseTvPolicyViewerPath(`/tv/p/${ref}`), ref);
    assert.equal(isStableTvPolicyRef(ref), true);
  }
});

test("PAP-1646 never embeds publish revision, device or sensitive session state", () => {
  const path = formatTvPolicyViewerPath(centerRef);
  assert.equal(path, `/tv/p/${centerRef}`);
  assert.ok(path && !/[?#]/.test(path));
  assert.ok(path && !/session|bearer|token|version|displayId/i.test(path));
  assert.equal(parseTvPolicyViewerPath(`/tv/${center}`), null);
  assert.equal(parseTvPolicyViewerPath(`/tv/p/${centerRef}/launch`), null);
});

test("PAP-1646 rejects forged, noncanonical and unsafe query-bearing refs", () => {
  const invalid: unknown[] = [
    "", null, undefined, 1, {}, [], "tvp1-default?token=abc",
    "tvp1-default#secret", "tvp1-default/", "TVP1-default", "tvp1-global",
    "tvp1-center-00000000-0000-4000-8000-000000000000",
    "tvp1-center-0199CE43-781B-7E14-8A72-836A2925F8A8",
    "tvp1-center-0199ce43-781b-7e14-7a72-836a2925f8a8",
    "tvp1-center-0199ce43-781b-7e14-8a72-836a2925f8a8?x=1",
    "tvp1-center-0199ce43-781b-7e14-8a72-836a2925f8a8%2Fadmin",
    `tvp1-center-${center}-extra`,
    "tvp1-center-", "../tvp1-default", "%2e%2e", "%74vp1-default",
  ];
  for (const ref of invalid) {
    assert.equal(isStableTvPolicyRef(ref), false, `unexpected valid ref: ${String(ref)}`);
    assert.equal(formatTvPolicyViewerPath(ref), null);
  }
});

test("PAP-1646 denies non-exact viewer paths and private URL decorations", () => {
  const invalid = [
    "/tv/p/", "/tv/p/tvp1-default/", "/tv/p/tvp1-default?draft=1",
    "/tv/p/tvp1-default#token", "/tv/p/tvp1-default%2F", "/tv/p/%74vp1-default",
    "/tv/p/tvp1-default/../secret", "/tv/p/tvp1-global",
    `/tv/p/${centerRef}?access_token=bad`,
    `/tv/p/${centerRef}/some-other-path`,
    `https://example.test/tv/p/${centerRef}`,
    `//example.test/tv/p/${centerRef}`,
    `/tv/${center}`,
  ];
  for (const path of invalid) assert.equal(parseTvPolicyViewerPath(path), null, path);
  for (const value of [null, [], {}, 99]) assert.equal(parseTvPolicyViewerPath(value), null);
});

test("PAP-1646 link shape never claims Center membership or published entitlement", () => {
  const first = formatTvPolicyViewerPath(centerRef);
  const second = formatTvPolicyViewerPath(centerRef);
  assert.equal(first, second);
  assert.equal(formatTvPolicyViewerPath("tvp1-default"), "/tv/p/tvp1-default");
  // An accepted ref is public routing metadata, never an auth decision.
  assert.equal(parseTvPolicyViewerPath(first), centerRef);
});
