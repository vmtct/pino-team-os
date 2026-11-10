// PAP-1803 · Guest shell reuses exactly the PINO unified mobile frame/nav classes.
import Link from "next/link";
import type {ReactNode} from "react";
import css from "../launcher.module.css";
const tabs=[
 {id:"home",label:"Bảng tin",glyph:"⌂",href:"/piner/public/login?returnTo=%2Fpiner"},
 {id:"grid",label:"Bộ sưu tập",glyph:"▦",href:"/piner/public/login?returnTo=%2Fpiner%2Fgrid"},
 {id:"reels",label:"Reels",glyph:"▷",href:"/piner/public/login?returnTo=%2Fpiner%2Freels"},
 {id:"community",label:"Cộng đồng",glyph:"♧",href:"/piner/public"}
] as const;
export default function GuestLayout({children}:{children:ReactNode}){
 return <div className={css.unifiedBackdrop}>
  <div className={css.unifiedShell} data-piner-shared="unified-shell" data-public-guest="true">
    <header className={css.unifiedHeader} data-piner-shared="unified-header">
     <Link href="/piner/public" className={css.guestHeaderCommunity}>Cộng đồng</Link>
     <Link href="/piner/public/login?returnTo=%2Fpiner" className={css.guestHeaderLogin}>Đăng nhập</Link>
     <Link href="/piner/public" aria-label="Logo PINO Space · Cộng đồng" className={css.unifiedLogo}>
      <strong>PINO</strong><small>SPACE</small>
     </Link>
    </header>
    <main className={css.unifiedContent} data-piner-slot="content" data-public-scroll-main>
     {children}
    </main>
    <nav className={css.unifiedNav} data-piner-shared="bottom-nav" aria-label="Điều hướng Piner Space">
     <div className={css.unifiedNavInner}>{tabs.map(item=><Link key={item.id} href={item.href}
       data-tab={item.id} aria-current={item.id==="community"?"page":undefined}
       className={item.id==="community"?css.unifiedNavActive:css.unifiedNavItem}>
       <span aria-hidden="true" className={css.guestNavGlyph}>{item.glyph}</span>
       <small>{item.label}</small>
     </Link>)}</div>
    </nav>
  </div>
 </div>;
}
