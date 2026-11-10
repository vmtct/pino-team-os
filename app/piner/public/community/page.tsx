import Link from "next/link";
import type {Metadata} from "next";
import {publicPosts} from "../post/publicCatalog";
import {MediaArtwork} from "../../MediaArtwork";
import css from "../../launcher.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Cộng đồng PINO · Piner Space",description:"Những tác phẩm được chọn chia sẻ công khai.",robots:{index:false,follow:false}};
export default function PublicCommunityPage(){
 const posts=publicPosts();
 return <>
  <h1 className={css.publicPageTitle}>Cộng đồng PINO</h1>
  <p className={css.publicLead}>Những bài được chọn chia sẻ công khai. Không cần đăng nhập.</p>
  <div className={css.publicList} data-public-feed>
   {posts.map(p=><Link href={"/piner/public/post/"+encodeURIComponent(p.id)}
      className={css.publicListCard} key={p.id} data-public-post={p.id}>
     <div className={css.publicThumb}><MediaArtwork post={p}/>{p.type==="reel"&&<span>▶</span>}</div>
     <div className={css.publicListText}><strong>{p.alias}</strong><b>{p.title}</b>
      <small>{p.app==="piano"?"Piano":"Hội Họa"} · {p.date}</small><p>{p.caption}</p></div>
   </Link>)}
  </div>
  <p className={css.publicDisclaimer}>Bản minh họa. Chỉ các bài được phép chia sẻ mới xuất hiện ở đây.</p>
 </>;
}
