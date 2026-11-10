// PAP-1805 · MyTime anonymous Community is a different audience from PINO House.
import type {Metadata} from "next";
import {publicPosts} from "../post/publicCatalog";
import {PublicFeedClient} from "../../PublicFeedClient";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Cộng đồng MyTime · Piner Space",description:"Thành quả nghệ thuật và Piano của người học trưởng thành.",robots:{index:false,follow:false}};
export default function PublicMyTime(){return <PublicFeedClient posts={publicPosts("mytime")} mode="community" space="mytime"/>;}
