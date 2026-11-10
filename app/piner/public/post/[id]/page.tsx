import Link from "next/link";
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {publicPost,publicPosts} from "../publicCatalog";
import {PublicMedia} from "../../../PublicMedia";
import css from "../../../launcher.module.css";
export const dynamicParams=false;
export function generateStaticParams(){return publicPosts().map(p=>({id:p.id}));}
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const p=publicPost((await params).id);
 return p?{title:p.title+" · Cộng đồng PINO",description:p.caption,robots:{index:false,follow:false}}:
  {title:"Không tìm thấy · Cộng đồng PINO",robots:{index:false,follow:false}};
}
export default async function PublicPostPage({params}:Props){
 const p=publicPost((await params).id);
 if(!p)notFound();
 return <article className={css.publicDetail} data-public-detail={p.id}>
   <Link href="/piner/public/community" className={css.publicBack} aria-label="Về Cộng đồng công khai">‹ Về Cộng đồng</Link>
   <div className={css.publicPostAuthor}><strong>{p.alias}</strong><small>{p.app==="piano"?"Piano":"Hội Họa"} · {p.date}</small></div>
   <PublicMedia post={p}/>
   <div className={css.publicDetailBody}><h1>{p.title}</h1>
    <p className={css.publicCaption} data-public-caption>{p.caption}</p>
    <section className={css.publicComments} aria-label="Bình luận">
     <h2>Bình luận ({p.comments.length})</h2>
     {p.comments.map(c=><p key={c.id}><strong>{c.author}</strong> {c.body}</p>)}
    </section>
   </div>
   <Link href="/piner/public/community" className={css.publicBackBottom}>Xem các bài Cộng đồng khác</Link>
 </article>;
}
