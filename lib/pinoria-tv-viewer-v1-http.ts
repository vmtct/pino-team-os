/** PAP-1646 / Epic PAP-650 PNR-TV: explicit status, non-streamed Viewer Response.
 * Async Next.js App Router pages can emit HTTP 200 before throwing NEXT_REDIRECT;
 * a per-route GET handler waits for both genuine Core authorizations before
 * sending headers or body. PAP-9 / PAP-1921 F3 remains LOCKED.
 */
import {
  policyViewerBlockedCopy, policyViewerBlockedReasonForHttpStatus,
} from "./pinoria-tv-viewer-admission";
import {
  readStaffPublishedViewer, type StaffPolicyViewerEnv,
} from "./pinoria-tv-viewer-v1-staff";

const HEADERS: Readonly<Record<string, string>> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
};

// Geometry and contrast mirror PAP-1646's already merged
// policy-viewer-frame.module.css. Static only: no scripts or CDN dependencies.
const STYLE = `
:root{color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
body{background:#0f0e13;color:#fff}
.stage{position:fixed;inset:0;width:100%;min-height:100vh;height:100dvh;
  display:grid;place-items:center;overflow:hidden;background:#0f0e13;color:#fff}
.landscape{position:relative;isolation:isolate;overflow:hidden;
  width:min(100vw,calc(100dvh * 16 / 9));aspect-ratio:16/9;max-width:100vw;max-height:100dvh;
  display:grid;place-items:center;text-align:center;padding:clamp(16px,4vw,64px)}
article{display:grid;gap:12px;justify-items:center;max-width:100%}
h1{font-size:clamp(28px,4.5vw,68px);line-height:1.12;margin:0}
p{font-size:clamp(14px,2vw,24px);line-height:1.5;margin:0;color:#c8c2d1}
a{color:#fff;text-underline-offset:4px}
`;

function document(body: string): string {
  return '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<title>Pinoria TV · PINO</title><style>' + STYLE + '</style></head><body>' +
    '<main class="stage" data-pnr-tv-viewer="view-only">' +
    '<section class="landscape" data-pnr-tv-frame="16:9" role="region" ' +
    'aria-label="Pinoria TV Ambient Welcome">' + body +
    '</section></main></body></html>';
}

export function blockedPolicyViewerHttp(status: 401 | 403 | 404 | 503): Response {
  const text = policyViewerBlockedCopy(policyViewerBlockedReasonForHttpStatus(status));
  // Only static allowlisted reason copy. No raw Core error, token, Center or PII.
  const login = status === 401 ? '<p><a href="/staff-login">Đăng nhập</a></p>' : "";
  const body = document('<article data-pnr-tv-viewer-blocked="true">' +
    '<h1>' + text.heading + '</h1><p>' + text.description + '</p>' + login + '</article>');
  return new Response(body, { status, headers: HEADERS });
}

/** Never emits a status/body before the server validates actual Core access. */
export async function handlePolicyViewerHttp(
  request: Request, env: StaffPolicyViewerEnv, policyRef: unknown,
): Promise<Response> {
  const outcome = await readStaffPublishedViewer(request, env, policyRef);
  if (outcome.kind === "blocked") return blockedPolicyViewerHttp(outcome.status);
  const policy = outcome.policy;
  // The only dynamic fields are strictly typed/revalidated number + boolean.
  // Render no staff, student, token, Center, events or private Context fields.
  const body = document('<article data-pnr-tv-published-policy="authorized">' +
    '<h1>Pinoria TV</h1><p>Ambient Welcome · Chính sách đang áp dụng</p>' +
    (policy.appliedRevision === null ? "" : '<p>Phiên bản ' + policy.appliedRevision + '</p>') +
    '<p>' + (policy.configuration.quietMode
      ? 'Chế độ yên tĩnh' : 'Chỉ xem chính sách đã xuất bản') + '</p></article>');
  return new Response(body, { status: 200, headers: HEADERS });
}
