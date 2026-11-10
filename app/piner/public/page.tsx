// PAP-1803 · Home for anonymous Community, reused feed layout and approved-only DTO.
import type {Metadata} from "next";
import {publicPosts} from "./post/publicCatalog";
import {PublicFeedClient} from "../PublicFeedClient";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Cộng đồng PINO · Piner Space",description:"Bài đã chia sẻ công khai trong Piner Space",robots:{index:false,follow:false}};
export default function GuestCommunity(){
 return <PublicFeedClient posts={publicPosts()} mode="community"/>;
}
