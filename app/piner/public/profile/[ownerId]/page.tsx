// PAP-1803 · Anonymous profile only projects approved shared posts from same author.
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {publicPosts} from "../../post/publicCatalog";
import {PublicFeedClient} from "../../../PublicFeedClient";
export const dynamicParams=false;
export function generateStaticParams(){
 return [...new Set(publicPosts().map(p=>p.ownerId))].map(ownerId=>({ownerId}));
}
type Props={params:Promise<{ownerId:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {ownerId}=await params;
 const profile=publicPosts().find(p=>p.ownerId===ownerId);
 return {title:(profile?profile.alias:"Không tìm thấy")+" · PINO Space",robots:{index:false,follow:false}};
}
export default async function PublicProfile({params}:Props){
 const {ownerId}=await params;
 const posts=publicPosts().filter(p=>p.ownerId===ownerId);
 if(!posts.length)notFound();
 return <PublicFeedClient mode="profile" posts={posts}/>;
}
