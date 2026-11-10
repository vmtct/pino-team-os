// PAP-1803 · Public deep link: chosen post inside its owner's vertically scrollable shared feed.
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {publicPost,publicPosts} from "../publicCatalog";
import {PublicFeedClient} from "../../../PublicFeedClient";
import {postSpace} from "../../../spaces";
export const dynamicParams=false;
export function generateStaticParams(){return publicPosts().map(p=>({id:p.id}));}
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const p=publicPost((await params).id);
 return p?{title:p.title+" · "+p.alias+" · PINO",description:p.caption,robots:{index:false,follow:false}}:
 {title:"Không tìm thấy bài đăng",robots:{index:false,follow:false}};
}
export default async function PublicSharedPost({params}:Props){
 const {id}=await params,p=publicPost(id);
 if(!p)notFound();
 const ownerPosts=publicPosts().filter(item=>item.ownerId===p.ownerId);
 return <PublicFeedClient mode="profile" posts={ownerPosts} selectedPostId={p.id} space={postSpace(p)}/>;
}
