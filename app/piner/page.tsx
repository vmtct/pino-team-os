import Link from "next/link";
import type { Metadata } from "next";
import { PINER_APPS } from "./catalog";
import { AppGlyph } from "./AppGlyph";
import styles from "./launcher.module.css";

export const metadata: Metadata = {
  title: "Piner Space · Thế giới của mình",
  description: "Piner Space — năm góc sáng tạo cùng PINO House."
};
export default function PinerHomePage() {
  return <main className={styles.shell}>
    <div className={styles.backgroundOrbs} aria-hidden="true"><span/><span/><span/></div>
    <div className={styles.wrap}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/piner" aria-label="Piner Space, trang chủ">
          <span className={styles.brandMark}>p<span>✳</span></span>
          <span className={styles.brandStack}><strong>PINER</strong><small>SPACE BY PINO</small></span>
        </Link>
        <div className={styles.account}><span className={styles.accountText}>Một góc nhỏ của bạn</span><span className={styles.avatar} aria-label="Tài khoản mẫu">✦</span></div>
      </header>

      <section className={styles.hero} aria-labelledby="piner-hero-heading">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><span className={styles.sparkle}>✳</span> HELLO, LITTLE EXPLORER</span>
          <h1 id="piner-hero-heading">Một thế giới.<br/><em>Rất nhiều điều hay.</em></h1>
          <p>Dành một chút thời gian cho âm nhạc, sắc màu và những điều mình yêu thích.</p>
          <a className={styles.heroCta} href="#ung-dung">Khám phá ngay <span aria-hidden="true">↗</span></a>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <span className={styles.heroHalo}/>
          <span className={styles.heroSun}>✳</span>
          <span className={styles.heroCanvas}><i/><i/><i/></span>
          <span className={styles.heroPiano}><b/><b/><b/><b/><b/></span>
          <span className={styles.heroPetal}>✦</span>
          <span className={styles.heroDot}/>
          <span className={styles.heroCaption}>make room for wonder</span>
        </div>
      </section>

      <section className={styles.appSection} id="ung-dung" aria-labelledby="piner-app-heading">
        <div className={styles.sectionHead}><div><span className={styles.sectionKicker}>CHỌN HÀNH TRÌNH CỦA BẠN</span><h2 id="piner-app-heading">Các ứng dụng</h2></div><span className={styles.appCount}>05 ứng dụng</span></div>
        <div className={styles.appGrid}>
          {PINER_APPS.map(app => {
            const content = <><span className={`${styles.iconPanel} ${styles[app.color]}`}><AppGlyph kind={app.id}/><span className={styles.iconGleam}/></span><span className={styles.appLabel}>{app.label}</span><span className={styles.appCaption}>{app.caption}</span></>;
            return app.id === "mytime"
              ? <a className={styles.appTile} key={app.id} href={app.href} aria-label={`Mở ${app.label}`}>{content}</a>
              : <Link className={styles.appTile} key={app.id} href={app.href} aria-label={`Mở ${app.label}`}>{content}</Link>;
          })}
        </div>
      </section>

      <section className={styles.noteBand}><span className={styles.noteIcon}>♡</span><div><strong>Chọn điều mình thích, theo cách của mình.</strong><p>Mỗi hành trình là một góc nhỏ để bạn khám phá và lớn lên mỗi ngày.</p></div><span className={styles.noteStar}>✧</span></section>
      <footer className={styles.footer}><span>© PINO HOUSE · ART & MUSIC</span><Link href="/piner/archive" className={styles.archiveLink}>Xem bản Piner V1 <span aria-hidden="true">↗</span></Link></footer>
    </div>
  </main>;
}
