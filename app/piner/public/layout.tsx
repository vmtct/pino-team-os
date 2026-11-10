"use client";
// PAP-1805 · Same guest PINO shell; route-derived theme/community context only.
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import {publicCommunityHref} from "../publicApproved";
import {pathFor,type PinerSpace} from "../spaces";
import css from "../launcher.module.css";
const tabs=[
 {id:"home",label:"Bảng tin",glyph:"⌂"},
 {id:"grid",label:"Bộ sưu tập",glyph:"▦"},
 {id:"reels",label:"Reels",glyph:"▷"},
 {id:"community",label:"Cộng đồng",glyph:"♧"}
] as const;
function guestSpace(pathname:string):PinerSpace{
 if(pathname.startsWith("/piner/public/mytime")||pathname.startsWith("/piner/public/profile/mai")||
    pathname.startsWith("/piner/public/post/a5")||pathname.startsWith("/piner/public/post/p5"))return "mytime";
 return "house";
}
export default function PublicLayout({children}:{children:ReactNode}){
 const path=usePathname(),space=guestSpace(path),current=publicCommunityHref(space);
 return <div className={css.unifiedBackdrop}>
  <div className={css.unifiedShell} data-piner-shared="unified-shell" data-piner-space={space} data-public-guest="true">
   <header className={css.unifiedHeader} data-piner-shared="unified-header">
    <Link href={current} className={css.guestHeaderCommunity}>{space==="mytime"?"MyTime":"PINO House"}</Link>
    <Link href={"/piner/public/login?returnTo="+encodeURIComponent(path)}
      className={css.guestHeaderLogin}>Đăng nhập</Link>
    <Link href="/piner" aria-label="Logo PINO Space · Ứng dụng" className={css.unifiedLogo}>
     <strong>PINO</strong><small>SPACE</small>
    </Link>
   </header>
   <main className={css.unifiedContent} data-piner-slot="content" data-public-scroll-main>{children}</main>
   <nav className={css.unifiedNav} data-piner-shared="bottom-nav" aria-label="Điều hướng Piner Space">
    <div className={css.unifiedNavInner}>{tabs.map(item=><Link key={item.id}
      href={item.id==="community"?current:"/piner/public/login?returnTo="+encodeURIComponent(pathFor(space,item.id))}
      data-tab={item.id} aria-current={item.id==="community"?"page":undefined}
      className={item.id==="community"?css.unifiedNavActive:css.unifiedNavItem}>
      <span aria-hidden="true" className={css.guestNavGlyph}>{item.glyph}</span><small>{item.label}</small>
    </Link>)}</div>
   </nav>
  </div>
 </div>;
}
