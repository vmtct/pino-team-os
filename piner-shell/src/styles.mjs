export const CSS=String.raw`
:root{color-scheme:light;--ink:#283241;--muted:#647077;--canvas:#faf8f3;--edge:#eae8e2;--mint:#eefaf6;--warm:#fffaf3}
*{box-sizing:border-box}
html,body{padding:0;margin:0;width:100%;min-height:100%;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:var(--ink)}
body{background:var(--canvas)}
a{color:inherit;text-decoration:none}
button{font:inherit}
button,a{-webkit-tap-highlight-color:transparent}
:focus-visible{outline:3px solid #407f9e;outline-offset:2px}
[hidden]{display:none!important}
.backdrop{min-height:100dvh;display:flex;justify-content:center;background:#e9e9e4}
.phone{width:100%;max-width:430px;height:100dvh;min-height:540px;overflow:hidden;background:#fff;box-shadow:0 0 36px #2b2a2911}
.launch-phone{background:#fffaf5 url("/piner_mobile_shell_background.png") center center/cover no-repeat}
.launch{min-height:100%;height:100%;display:flex;flex-direction:column;overflow:auto;padding:env(safe-area-inset-top) 15px calc(18px + env(safe-area-inset-bottom))}
.launch-brand{height:clamp(174px,27.5dvh,245px);flex:0 0 clamp(174px,27.5dvh,245px);display:flex;justify-content:center;align-items:center;flex-direction:column}
.launch-sigil{width:45px;height:45px;object-fit:contain;margin-bottom:-5px;filter:drop-shadow(0 2px 3px #967a6d22)}
.launch-wordmark{width:clamp(108.8px,33.04%,140px);height:auto;max-height:80px;object-fit:contain}
.programs{display:flex;flex-direction:column;gap:clamp(13px,2dvh,20px)}
.program-card{position:relative;display:block;width:100%;min-height:166px;aspect-ratio:1.73;max-height:244px;border-radius:clamp(20px,5vw,27px);overflow:hidden;background:#fffcf5;box-shadow:0 9px 26px #765e4811;isolation:isolate}
.card-photo{position:absolute;inset:0 -10% 0 10%;background-size:cover;background-repeat:no-repeat;z-index:0}
.house .card-photo{background-image:url("/piner_journey_background.png");background-position:52% center}
.mytime .card-photo{background-image:url("/piner_mytime_background.png");background-position:58% center}
.mytime.program-card{background:#f0fcf9}
.card-fade{position:absolute;inset:0;background:linear-gradient(90deg,#fffcf5 0%,#fffcf5 6%,rgba(255,252,245,0) 33%);z-index:1;pointer-events:none}
.mytime .card-fade{background:linear-gradient(90deg,#f0fcf9 0%,#f0fcf9 6%,rgba(240,252,249,0) 33%)}
.card-copy{position:relative;z-index:2;max-width:73%;height:100%;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:12px 0 12px clamp(18px,5.5vw,27px)}
.card-copy strong{font-family:ui-rounded,"Arial Rounded MT Bold","Trebuchet MS",Arial,sans-serif;font-size:clamp(26px,7.4vw,37px);font-weight:800;line-height:1.03;letter-spacing:-.06em}
.house .card-copy strong .pino-word,.house .card-copy strong .afterschool-word{display:block}
.house .card-copy strong .pino-word{font-size:calc(1em + 2px)}
.house .card-copy strong .afterschool-word{font-size:calc(.4244em - 2px);letter-spacing:-.06em;line-height:1.08}
.card-copy strong small{font-size:.56em;display:block;font-weight:700;letter-spacing:-.02em;margin-top:4px}
.tagline{font-size:clamp(12px,3.4vw,15px);line-height:1.35;margin-top:12px;color:#5d6770}
.arrow{margin-top:13px;width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:#fffefeea;font-size:22px;box-shadow:0 3px 12px #2b2a2914}
.launch-note{font-size:11px;color:#8c8d85;text-align:center;letter-spacing:.02em;margin:auto 0 0;padding-top:24px}
.member{height:100%;display:flex;flex-direction:column;position:relative;background:#fdfcfb}
.app-header{height:56px;min-height:56px;position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px;border-bottom:1px solid #f0efec;background:#fff;transition:transform .22s ease,margin-bottom .22s ease,opacity .17s ease;will-change:transform}
.brand{height:44px;min-height:44px;max-width:152px;min-width:0;display:flex;align-items:center;gap:5px;flex:0 1 auto}
.brand .sigil{width:29px;height:29px;flex:none;object-fit:contain}
.brand .wordmark{width:auto;height:29px;max-width:110px;object-fit:contain}
.profile-switch{height:39px;max-width:174px;min-width:0;display:inline-flex;align-items:center;gap:7px;padding:0 9px;border:1px solid #e9e9e4;border-radius:13px;color:#464b4a;background:#fafbf9;font-size:12px;font-weight:550;cursor:pointer}
.profile-switch .avatar{background:#e9f3ea;border-radius:50%;width:22px;height:22px;display:grid;place-items:center;flex:none;color:#6b9479;font-size:14px}
.profile-switch>span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.profile-switch>.chevron{font-size:15px;color:#858d89}
.profile-panel{position:absolute;right:12px;top:51px;width:min(288px,calc(100% - 24px));padding:19px;border-radius:16px;border:1px solid #e7e9e6;box-shadow:0 12px 30px #242b3122;background:#fff;z-index:20}
.profile-panel strong{font-size:14px}
.profile-panel p{font-size:12px;line-height:1.55;color:#667077}
.profile-panel button{margin-top:4px;border:0;background:#eff3f1;padding:11px 18px;border-radius:11px;cursor:pointer}
.scroll-content{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;background:#fff}
.scroll-content::-webkit-scrollbar{display:none}
.feed-inner{padding:16px 13px 28px;min-height:1150px}
.feed-inner h1{font-size:16px;font-weight:650;line-height:1.25;margin:0 0 16px;padding:0 2px}
.empty-state{background:#f4f8f5;border:1px solid #e6ede8;border-radius:18px;padding:25px 18px 22px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:16px}
.empty-art{height:42px;width:42px;border-radius:50%;background:#e5f1e9;color:#7b9985;font-size:30px;display:grid;place-items:center}
.empty-state strong{font-size:15px;font-weight:650}
.empty-state p{font-size:13px;line-height:1.55;color:#65736a;max-width:270px;margin:0}
.empty-state small{font-size:11px;letter-spacing:.01em;color:#889790}
.post-skeleton{border:1px solid #eff0ec;border-radius:17px;padding:13px;margin-bottom:17px}
.skeleton-heading{height:15px;width:36%;border-radius:12px;background:#eaeceb;margin-bottom:13px}
.skeleton-picture{height:268px;border-radius:12px;background:linear-gradient(125deg,#e8ebeb,#f4f5f3 52%,#e8ebeb)}
.skeleton-caption{height:11px;width:63%;border-radius:12px;background:#eaeceb;margin-top:14px}
.grid-skeleton{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 0 14px}
.grid-skeleton i{height:170px;border-radius:13px;background:linear-gradient(125deg,#ecefee,#f4f4f3,#ecefee)}
.reel-skeleton{width:100%;height:360px;border-radius:18px;background:linear-gradient(125deg,#e6e8e8,#f5f5f4,#e6e8e8);margin-bottom:17px}
.ending{text-align:center;font-size:11px;color:#939a94;padding:20px 0}
.bottom-nav{height:70px;min-height:70px;display:grid;grid-template-columns:repeat(4,1fr);align-items:stretch;padding-bottom:env(safe-area-inset-bottom);border-top:1px solid #eeefec;background:#fff;z-index:4;transition:transform .22s ease,margin-top .22s ease,opacity .17s ease;will-change:transform}
.tab-link{display:flex;align-items:center;justify-content:center;gap:3px;flex-direction:column;color:#858c8a;font-size:11px;font-weight:520;white-space:nowrap}
.tab-link.selected{color:#3d6656;font-weight:650}
.tab-symbol{font-size:19px;line-height:22px;display:block}
.member[data-chrome-collapsed="true"] .app-header{margin-bottom:-56px;transform:translateY(-100%);opacity:0;pointer-events:none}
.member[data-chrome-collapsed="true"] .bottom-nav{margin-top:-70px;transform:translateY(100%);opacity:0;pointer-events:none}
@media(max-width:345px){
 .launch{padding-inline:11px}
 .launch-brand{height:clamp(155px,25dvh,180px);flex-basis:clamp(155px,25dvh,180px)}
 .program-card{min-height:155px;aspect-ratio:1.84}
 .card-copy strong{font-size:25px}
 .tagline{font-size:11px}
 .app-header{gap:5px;padding-inline:9px}
 .brand{gap:3px;max-width:126px}
 .brand .sigil,.brand .wordmark{height:24px}
 .brand .sigil{width:24px}
 .profile-switch{font-size:11px;max-width:158px}
}
@media(prefers-reduced-motion:reduce){
 .app-header,.bottom-nav{transition:none}
}
@media(min-width:431px){
 .backdrop{align-items:center}
 .phone{box-shadow:0 2px 22px #6d746b22}
}
`;
