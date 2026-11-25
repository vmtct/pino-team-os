export const PORTFOLIO_CSS=String.raw`
/* PAP-2377 — scoped native Piner portfolio; preserve the existing mobile chrome. */
.portfolio{min-width:0;color:#33303c}
.portfolio-post{margin:0 0 20px;background:#fff;overflow:hidden}
.portfolio-post-header{display:flex;flex-direction:column;gap:3px;padding:12px 14px;font-size:14px}
.portfolio-post-header time,.portfolio-copy time{font-size:11px;color:#77717d}
.portfolio-cover{position:relative;display:block;width:100%;padding:0;border:0;background:#f4f0eb;cursor:pointer;text-align:left}
.portfolio-cover img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
.portfolio-count{position:absolute;right:10px;top:10px;padding:4px 9px;border-radius:999px;background:#332e3cba;color:white;font-size:12px}
.portfolio-copy{padding:12px 14px;font-size:14px;line-height:1.55;overflow-wrap:anywhere}
.portfolio-copy p{margin:0 0 8px}
.portfolio-feedback{border-left:2px solid #d5b7cc;padding:8px 12px;background:#faf5f8;border-radius:0 8px 8px 0}
.portfolio-feedback strong{font-size:12px;color:#805a7b}
.portfolio-feedback p{margin:3px 0 0}
.portfolio-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}
.portfolio-grid button{display:block;min-width:0;aspect-ratio:1;padding:0;border:0;background:#f4f0eb;overflow:hidden;cursor:pointer}
.portfolio-grid img{width:100%;height:100%;object-fit:cover;display:block}
.portfolio button:focus-visible,.portfolio-state button:focus-visible{outline:2px solid #805a7b;outline-offset:-3px}
.portfolio-viewer{border:0;padding:0;margin:auto;width:min(100%,430px);max-width:100%;height:100dvh;max-height:100dvh;background:#fff;color:#33303c;overflow:auto}
.portfolio-viewer::backdrop{background:#241c2bd9}
.portfolio-viewer-top{display:flex;align-items:center;justify-content:space-between;min-height:52px;padding:5px 14px;gap:12px}
.portfolio-viewer-top button,.portfolio-controls button{border:0;border-radius:999px;background:#f5eaf0;color:#805a7b;font-size:23px;width:44px;height:44px;cursor:pointer}
.portfolio-slides{background:#25212a;touch-action:pan-y}
.portfolio-slides img{display:block;width:100%;height:min(55dvh,430px);object-fit:contain}
.portfolio-controls{display:flex;align-items:center;justify-content:center;gap:20px;padding:10px;font-size:13px;color:#77717d}
.portfolio-controls button:disabled{opacity:.35;cursor:default}
.portfolio-state button{min-height:44px;border:0;border-radius:10px;background:#f5eaf0;color:#805a7b;padding:8px 16px}
.portfolio [hidden]{display:none!important}
`;
