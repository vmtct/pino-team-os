import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PINER_LOCAL_APPS, type PinerApp } from "../catalog";
import { AppGlyph } from "../AppGlyph";
import styles from "../launcher.module.css";
type Props = { params: Promise<{ app: string }> };
export function generateStaticParams() { return PINER_LOCAL_APPS.map(item => ({ app: item.id })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params;
  const found = PINER_LOCAL_APPS.find(item => item.id === app);
  return { title: found ? `${found.label} · Piner Space` : "Piner Space" };
}
export default async function PinerAppShell({ params }: Props) {
  const { app: id } = await params;
  const app = PINER_LOCAL_APPS.find(item => item.id === id);
  if (!app) notFound();
  const entry = app as PinerApp;
  return <main className={`${styles.shell} ${styles.appScreen}`}>
    <div className={styles.backgroundOrbs} aria-hidden="true"><span/><span/><span/></div>
    <div className={styles.wrap}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/piner"><span className={styles.brandMark}>p<span>✳</span></span><span className={styles.brandStack}><strong>PINER</strong><small>SPACE BY PINO</small></span></Link>
        <Link href="/piner" className={styles.backTop}>← <span>Ứng dụng</span></Link>
      </header>
      <div className={styles.breadcrumb}><Link href="/piner">Piner Space</Link><span>/</span><span>{entry.label}</span></div>
      <section className={`${styles.detailHero} ${styles[entry.color]}`}>
        <div className={styles.detailCopy}><span className={styles.eyebrow}>{entry.eyebrow}</span><h1>{entry.label}</h1><p>{entry.experience}</p><span className={styles.previewPill}><span/> BẢN XEM TRƯỚC</span></div>
        <div className={styles.detailGlyph}><AppGlyph kind={entry.id}/></div>
      </section>
      <section className={styles.detailSection}><div className={styles.sectionHead}><div><span className={styles.sectionKicker}>DÀNH RIÊNG CHO HÀNH TRÌNH NÀY</span><h2>Mình sẽ khám phá gì?</h2></div></div>
        <div className={styles.ideaGrid}>{entry.ideas.map((idea,index)=><div className={styles.ideaCard} key={idea}><span className={styles.ideaNumber}>0{index+1}</span><strong>{idea}</strong><span className={styles.ideaArrow} aria-hidden="true">↗</span></div>)}</div>
      </section>
      <div className={styles.emptyCallout}><span>✳</span><div><strong>Đây là App Shell dành cho Founder review.</strong><p>Nội dung và chức năng học tập sẽ được thiết kế riêng ở bước tiếp theo.</p></div></div>
      <div className={styles.returnRow}><Link className={styles.returnButton} href="/piner">← Về Piner Space</Link></div>
      <footer className={styles.footer}><span>© PINO HOUSE · ART & MUSIC</span><span>LOCAL PROTOTYPE · PAP-1747</span></footer>
    </div>
  </main>;
}
