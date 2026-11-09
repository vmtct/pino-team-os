// PAP-1749 · PNR-APP-HUB · one structure for every member app, only theme tokens differ.
// Layout mirrors TOS PAP-934: 430px phone frame, 60px app header, 76px bottom nav, 44px targets.
import Link from "next/link";
import { AppGlyph } from "./AppGlyph";
import { PINER_APPS, type PinerApp, type PinerAppKey } from "./catalog";
import { APP_NAV, getTabHref, type NavIcon } from "./navigation";
import styles from "./launcher.module.css";

function NavGlyph({ name }: { name: NavIcon }) {
  const common = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>;
    case "spark": return <svg {...common}><path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/></svg>;
    case "art": return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="2"/><path d="m4 18 6-6 4 4 3-3 4 4"/></svg>;
    case "music": return <svg {...common}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    case "book": return <svg {...common}><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/></svg>;
    case "star": return <svg {...common}><path d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1Z"/></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
    case "ticket": return <svg {...common}><path d="M3 8a2 2 0 0 0 0 4v5h18v-5a2 2 0 0 0 0-4V5H3v3Z"/><path d="M13 5v12" strokeDasharray="2 3"/></svg>;
    case "piano": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v8M12 5v8M17 5v8M3 14h18"/></svg>;
    case "palette": return <svg {...common}><path d="M12 3c-5 0-9 3.9-9 9 0 5 3.3 9 8 9 2 0 3-1 3-2.4 0-.8-.5-1.6-.5-2.2 0-1.1.8-1.4 2.3-1.4H18c3 0 4-2.4 3-5.3A9.8 9.8 0 0 0 12 3Z"/><circle cx="8" cy="9" r="1"/><circle cx="13" cy="7" r="1"/><circle cx="17" cy="10" r="1"/><circle cx="8" cy="15" r="1"/></svg>;
  }
}

export function PhoneFrame({ theme, children }: { theme: PinerAppKey | "home"; children: React.ReactNode }) {
  return <div className={styles.desktopBackdrop}><div className={styles.phoneFrame} data-piner-theme={theme} data-piner-shared="phone-frame">{children}</div></div>;
}
function HomeHeader() {
  return <header className={styles.homeHeader} data-piner-shared="home-header">
    <div className={styles.homeGreeting}><span className={styles.avatar}>P</span><div><small>PINO · PINER SPACE</small><h1>Xin chào, bạn!</h1></div></div>
    <span className={styles.headerEmblem} aria-label="Thế giới Piner">✳</span>
  </header>;
}
export function PinerHome() {
  return <PhoneFrame theme="home">
    <HomeHeader/>
    <main className={styles.homeContent} data-piner-slot="home-content">
      <div className={styles.contextCard}><div><span className={styles.contextKicker}>HÔM NAY MÌNH THÍCH GÌ?</span><strong>Chọn một điều thật vui!</strong><p>Mỗi trải nghiệm là một khám phá mới.</p></div><span className={styles.contextDecoration} aria-hidden="true">✦</span></div>
      <section className={styles.appsSection} aria-labelledby="apps-heading">
        <div className={styles.sectionHeading}><h2 id="apps-heading">Ứng dụng</h2><span>5 apps</span></div>
        <div className={styles.appGrid} data-piner-slot="app-grid">
          {PINER_APPS.map(app => <Link key={app.id} href={app.href} prefetch={false} className={styles.appTile} aria-label={"Mở " + app.label} data-app={app.id}>
            <span className={styles.iconFrame} data-icon-theme={app.color}><AppGlyph kind={app.id}/></span>
            <span className={styles.appLabel}>{app.label}</span>
          </Link>)}
        </div>
      </section>
      <p className={styles.homeNote}>Học, chơi và sáng tạo cùng PINO ♡</p>
      <footer className={styles.homeFooter}><span>PINO HOUSE · ART & MUSIC</span><Link href="/piner/archive">Piner V1 ↗</Link></footer>
    </main>
  </PhoneFrame>;
}
function AppHeader({ app }: { app: PinerApp }) {
  return <header className={styles.appHeader} data-piner-shared="app-header">
    <div className={styles.appIdentity}>
      <span className={styles.headerAppIcon}><AppGlyph kind={app.id}/></span>
      <div><strong>{app.label}</strong><small>PINO HOUSE · PROTOTYPE</small></div>
    </div>
    <Link href="/piner" className={styles.homeAction} aria-label="Về Piner Space" title="Về Piner Space"><NavGlyph name="home"/></Link>
  </header>;
}
function BottomNav({ app, active }: { app: PinerApp; active: string }) {
  return <nav className={styles.bottomNav} data-piner-shared="bottom-nav" data-nav-app={app.id} aria-label={"Điều hướng " + app.label}>
    {APP_NAV[app.id].map(item => <Link key={item.id} href={getTabHref(app.id,item.id)} prefetch={false} aria-current={item.id===active?"page":undefined} data-tab={item.id} className={item.id===active?styles.navActive:styles.navItem}>
      <span className={styles.navIcon}><NavGlyph name={item.icon}/></span><span className={styles.navLabel}>{item.label}</span>
    </Link>)}
  </nav>;
}
export function PinerAppScreen({ app, tab }: { app: PinerApp; tab: string }) {
  const nav = APP_NAV[app.id];
  const current = nav.find(x=>x.id===tab) || nav[0];
  const isHome = current.id === "home";
  const descriptions = isHome ? app.ideas : [current.label + " của bạn", "Hoạt động mới nhất", "Khám phá thêm"];
  return <PhoneFrame theme={app.id}>
    <AppHeader app={app}/>
    <main className={styles.appContent} data-piner-slot="app-content" data-active-tab={current.id}>
      <section className={styles.appWelcome}>
        <div><small>{app.eyebrow}</small><h1>{isHome?app.label:current.label}</h1><p>{isHome?app.experience:app.descriptor}</p></div>
        <span className={styles.welcomeArtwork}><AppGlyph kind={app.id}/></span>
      </section>
      <div className={styles.sectionHeading}><h2>{isHome?"Dành cho bạn":current.label}</h2><span>Khám phá</span></div>
      <div className={styles.cardList}>
        {descriptions.map((item, idx)=><article className={styles.featureCard} key={item}>
          <span className={styles.featureSymbol}><NavGlyph name={nav[(idx+1)%nav.length].icon}/></span>
          <div><strong>{item}</strong><small>{isHome?app.caption:"Bản xem trước · sẽ cập nhật"}</small></div>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </article>)}
      </div>
      {app.id==="mytime"&&<a className={styles.outboundLink} href="/mytime">Mở website MyTime <span aria-hidden="true">↗</span></a>}
      <p className={styles.appNotice}>Bản prototype · nội dung sẽ được hoàn thiện sau khi duyệt giao diện.</p>
    </main>
    <BottomNav app={app} active={current.id}/>
  </PhoneFrame>;
}
