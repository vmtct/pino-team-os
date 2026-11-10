import Link from "next/link";
import type {ReactNode} from "react";
import css from "../launcher.module.css";
export default function PublicLayout({children}:{children:ReactNode}){
 return <div className={css.publicBackdrop}><div className={css.publicShell}>
   <header className={css.publicHeader}>
    <Link href="/piner/public/community" aria-label="PINO Space - Cộng đồng" className={css.publicBrand}>PINO <small>SPACE</small></Link>
    <Link href="/piner/public/community" className={css.publicCommunityLink}>Cộng đồng</Link>
   </header>
   <main className={css.publicMain}>{children}</main>
   <footer className={css.publicFooter}><Link href="/piner/public/community">⌂ Cộng đồng công khai</Link></footer>
 </div></div>;
}
