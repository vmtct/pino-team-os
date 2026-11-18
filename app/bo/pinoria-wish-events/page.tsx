import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {BoWishRuntime} from "./BoWishRuntime";
export const dynamic="force-dynamic";
export default async function Page(){if((await headers()).get("host")?.toLowerCase().split(":")[0]!=="bo.staging.pinohouse.art")notFound();return <BoWishRuntime/>;}
