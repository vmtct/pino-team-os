import {PORTFOLIO_CSS} from "./portfolio-styles.mjs";
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
.program-card{position:relative;display:block;width:100%;min-height:166px;aspect-ratio:1.73;max-height:244px;border-radius:clamp(20px,5vw,27px);overflow:hidden;background:#fffcf5;box-shadow:0 9px 26px #765e481c,0 2px 6px #765e480a;isolation:isolate}
.card-photo{position:absolute;inset:0 -10% 0 10%;background-size:cover;background-repeat:no-repeat;z-index:0}
.house .card-photo{background-image:url("/piner_journey_background.png");background-position:52% center}
.mytime .card-photo{background-image:url("/piner_mytime_background.png");background-position:58% center}
.mytime.program-card{background:#f0fcf9}
.card-fade{position:absolute;inset:0;background:linear-gradient(90deg,#fffcf5 0%,#fffcf5 10%,rgba(255,252,245,0) 33%);z-index:1;pointer-events:none}
.mytime .card-fade{background:linear-gradient(90deg,#f0fcf9 0%,#f0fcf9 10%,rgba(240,252,249,0) 33%)}
.card-copy{position:relative;z-index:2;max-width:73%;height:100%;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:12px 0 12px clamp(18px,5.5vw,27px)}
.card-copy strong{font-family:ui-rounded,"Arial Rounded MT Bold","Trebuchet MS",Arial,sans-serif;font-size:clamp(26px,7.4vw,37px);font-weight:800;line-height:1.03;letter-spacing:-.06em}
.house .card-copy strong .pino-word,.house .card-copy strong .afterschool-word{display:block}
.house .card-copy strong .pino-word{font-size:calc(1em + 2px)}
.house .card-copy strong .afterschool-word{font-size:calc(.4244em);letter-spacing:-.06em;line-height:1.08}
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
.empty-state [data-afterschool-login]{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 8px;font-weight:650;text-decoration:underline;text-underline-offset:3px}
.post-skeleton{border:1px solid #eff0ec;border-radius:17px;padding:13px;margin-bottom:17px}
.skeleton-heading{height:15px;width:36%;border-radius:12px;background:#eaeceb;margin-bottom:13px}
.skeleton-picture{height:268px;border-radius:12px;background:linear-gradient(125deg,#e8ebeb,#f4f5f3 52%,#e8ebeb)}
.skeleton-caption{height:11px;width:63%;border-radius:12px;background:#eaeceb;margin-top:14px}
.grid-skeleton{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 0 14px}
.grid-skeleton i{height:170px;border-radius:13px;background:linear-gradient(125deg,#ecefee,#f4f4f3,#ecefee)}
.reel-skeleton{width:100%;height:360px;border-radius:18px;background:linear-gradient(125deg,#e6e8e8,#f5f5f4,#e6e8e8);margin-bottom:17px}
.ending{text-align:center;font-size:11px;color:#939a94;padding:20px 0}
.member>.scroll-content{
 scroll-padding-bottom:calc(83px + env(safe-area-inset-bottom));
 padding-bottom:calc(83px + env(safe-area-inset-bottom));
}
.bottom-nav{
 position:absolute;left:50%;bottom:calc(11px + env(safe-area-inset-bottom));
 width:calc(100% - 30px);max-width:388px;height:72px;padding:3px 6px;
 display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;
 border-radius:999px;border:1px solid rgba(255,255,255,.86);
 background:rgba(251,250,253,.77);backdrop-filter:blur(15px) saturate(1.17);
 box-shadow:0 6px 26px rgba(27,19,38,.14),0 1px 4px rgba(33,23,44,.10);
 transform:translateX(-50%) scale(1);z-index:4;
 transition:transform .23s cubic-bezier(.18,.85,.22,1);
}
.tab-link{display:flex;align-items:center;justify-content:center;gap:3px;flex-direction:column;color:#858c8a;font-size:11px;font-weight:520;white-space:nowrap}
.tab-link.selected{color:#3d6656;font-weight:650}
.tab-symbol{font-size:19px;line-height:22px;display:block}
.member[data-chrome-collapsed="true"] .app-header{margin-bottom:-56px;transform:translateY(-100%);opacity:0;pointer-events:none}
.member[data-chrome-collapsed="true"] .bottom-nav[data-past-collapse-threshold="true"]:not(:focus-within){
 transform:translateX(-50%) scale(.7);
}
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
/* PAP-2194 member chrome; leaves anonymous shell unchanged. */
[data-member-chrome] .member-actions{display:flex;justify-content:center;margin-top:12px}
[data-member-chrome] [data-sign-out]{border:0;background:transparent;color:#647077;font-size:13px;font-weight:600;min-height:44px;cursor:pointer}
[data-member-chrome] .member-profile .student-options{display:grid;gap:5px;margin:10px 0}
[data-member-chrome] .member-profile .student-options button{display:block;width:100%;text-align:left;min-height:44px;margin:0;padding:10px 12px;border-radius:10px;background:#f7f8f6}
[data-member-chrome] .member-profile .student-options button[aria-pressed=true]{background:#e9f3ea;color:#3d6656;font-weight:650}
[data-member-chrome] .member-profile [data-sign-out]{display:block;width:100%;text-align:left;border-top:1px solid #eae8e2;border-radius:0;margin-top:10px;padding:10px 12px}
/* PAP-2194 M1: exactly one visible viewport for the launcher. */
.launch-phone[data-member-chrome]{height:100vh;height:100dvh;min-height:0;overflow:hidden}
.launch-phone[data-member-chrome] .launch{height:100%;min-height:0;overflow:hidden;display:grid;grid-template-rows:minmax(0,1fr) minmax(0,3fr) 44px auto;gap:clamp(6px,1.5dvh,14px);padding-top:max(6px,env(safe-area-inset-top));padding-bottom:max(8px,env(safe-area-inset-bottom))}
.launch-phone[data-member-chrome] .launch-brand{height:auto;min-height:0;flex:none;overflow:hidden}
.launch-phone[data-member-chrome] .programs{min-height:0;display:grid;grid-template-rows:repeat(2,minmax(0,1fr));gap:clamp(12px,2.6dvh,22px)}
.launch-phone[data-member-chrome] .program-card{min-height:0;height:100%;max-height:none;aspect-ratio:auto}
.launch-phone[data-member-chrome] .card-copy{min-height:0;padding-block:6px}
.launch-phone[data-member-chrome] .card-copy strong{font-size:clamp(20px, min(7.4vw,4.4dvh),37px)}
.launch-phone[data-member-chrome] .tagline{margin-top:clamp(3px,1.2dvh,12px)}
.launch-phone[data-member-chrome] .arrow{margin-top:clamp(3px,1.2dvh,13px);width:clamp(26px,5dvh,42px);height:clamp(26px,5dvh,42px)}
.launch-phone[data-member-chrome] .member-actions{margin:0;align-items:center}
.launch-phone[data-member-chrome] .launch-note{padding:0;margin:0}
 @media(max-height:560px){.launch-phone[data-member-chrome] .launch-sigil{width:29px;height:29px}.launch-phone[data-member-chrome] .launch-wordmark{max-height:40px}.launch-phone[data-member-chrome] .arrow{display:none}}
/* PAP-2194: canonical PAP-1823 / PAP-1901 visual parity, authenticated chrome only. */
[data-member-chrome] .member{--member-ink:#33303c;--member-muted:#77717d;--member-tone:#805a7b;--member-tint:#f5eaf0;--member-line:#e8e0e9}
[data-member-chrome] .app-header{height:50px;min-height:50px;flex:0 0 50px;padding:3px 14px;gap:12px;border:0;color:var(--member-ink);background:#fff}
[data-member-chrome] .profile-switch{height:44px;min-height:44px;max-width:190px;gap:6px;padding:0 5px 0 0;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--member-ink);font-size:13px;font-weight:600}
[data-member-chrome] .profile-switch .avatar{width:28px;height:28px;flex:0 0 28px;background:var(--member-tint);color:var(--member-tone);font-size:12px;font-weight:600}
[data-member-chrome] .profile-switch>.profile-chevron{font-size:18px;color:var(--member-tone);line-height:1;font-weight:450;transition:transform .16s ease}
[data-member-chrome] .profile-switch[aria-expanded=true]>.profile-chevron{transform:rotate(180deg)}
[data-member-chrome] .member-profile{top:52px;right:14px;width:min(282px,calc(100% - 25px));padding:7px;border:1px solid var(--member-line);border-radius:15px;background:#fff;box-shadow:0 13px 34px #33203526;max-height:min(350px,calc(100dvh - 90px));overflow:auto;color:var(--member-ink);font-size:15px}
[data-member-chrome] .student-title{font-size:10px;letter-spacing:.075em;color:var(--member-muted);font-weight:650;text-transform:uppercase;padding:8px 10px 6px}
[data-member-chrome] .member-profile .student-options{display:block;margin:0}
[data-member-chrome] .member-profile .student-options button{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;margin:2px 0;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:var(--member-ink);text-align:left;cursor:pointer}
[data-member-chrome] .member-profile .student-options button:hover,[data-member-chrome] .member-profile .student-options button:focus-visible{background:var(--member-tint);outline:2px solid var(--member-tone);outline-offset:-2px}
[data-member-chrome] .member-profile .student-options button[aria-selected=true]{background:var(--member-tint)}
[data-member-chrome] .student-avatar{width:36px;height:36px;flex:0 0 36px;border-radius:50%;display:grid;place-items:center;background:white;color:var(--member-tone);font-size:14px;font-weight:650;border:1px solid var(--member-line)}
[data-member-chrome] .student-label{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}
[data-member-chrome] .student-label strong{font-size:13px;font-weight:650;line-height:1.3;color:var(--member-ink)}
[data-member-chrome] .student-label small{font-size:10px;line-height:1.3;color:var(--member-muted);font-weight:450;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-member-chrome] .student-check{display:none;place-items:center;flex:0 0 22px;width:22px;height:22px;border-radius:50%;background:var(--member-tone);color:white;font-size:13px;font-weight:700}
[data-member-chrome] [aria-selected=true] .student-check{display:grid}
[data-member-chrome] .member-profile [data-sign-out]{color:var(--member-muted);margin:4px 0 0}
[data-member-chrome] .bottom-nav{min-height:72px;transform-origin:50% 50%;z-index:24}
[data-member-chrome] .bottom-nav .tab-link{display:flex;align-items:center;justify-content:center;min-height:64px;height:64px;padding:0;border-radius:999px;color:var(--member-muted);gap:1px;font-size:15px;font-weight:400}
[data-member-chrome] .bottom-nav .tab-link.selected{background:rgba(95,75,109,.10);color:var(--member-tone)}
[data-member-chrome] .bottom-nav svg[data-line-icon]{width:25px;height:25px;flex:0 0 25px;display:block;fill:none;stroke:currentColor;stroke-width:1.7}
[data-member-chrome] .member[data-chrome-collapsed=true] .app-header{margin-bottom:-50px}
 @media(max-width:345px){[data-member-chrome] .app-header{gap:5px;padding-inline:9px}[data-member-chrome] .member-profile{right:9px;width:min(282px,calc(100% - 20px))}}
/* PAP-2194 launcher interaction: fine-pointer hover, touch press, keyboard focus. */
.launch-phone[data-member-chrome] .program-card{transition:transform .18s ease,box-shadow .18s ease}
.launch-phone[data-member-chrome] .program-card .arrow{transition:transform .18s ease,background-color .18s ease}
 @media(hover:hover) and (pointer:fine){.launch-phone[data-member-chrome] .program-card:hover{transform:translateY(-2px);box-shadow:0 13px 30px #765e4828,0 3px 8px #765e4811}.launch-phone[data-member-chrome] .program-card:hover .arrow{transform:translateX(3px);background:#fff}}
.launch-phone[data-member-chrome] .program-card[data-pressed=true],.launch-phone[data-member-chrome] .program-card:active{transform:scale(.985);box-shadow:0 4px 14px #765e481c}
.launch-phone[data-member-chrome] .program-card:focus-visible{outline:2px solid #805a7b;outline-offset:3px}
 @media(prefers-reduced-motion:reduce){.launch-phone[data-member-chrome] .program-card,.launch-phone[data-member-chrome] .program-card .arrow{transition:none;transform:none!important}}
[data-member-session][hidden]{display:none!important}
[data-member-session] [data-member-status]{font-size:12px;color:#805a7b;margin:4px 8px}
[data-member-session] [data-member-status]:empty{display:none}

`+PORTFOLIO_CSS;
