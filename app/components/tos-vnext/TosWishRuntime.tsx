"use client";
/** PAP-2031 independent selected-learner adapter; Reception keeper supplies actual Core-selected learner. */
import {useEffect,useMemo,useState,useSyncExternalStore} from "react";
import {TosVNextButton} from "../tos-ds";
import {TosWishExecution} from "./TosWishExecution";
import {browserTosWishHost,readWishActor} from "@/lib/tos-pls-wish-client";
type Props={centerId:string;learnerId:string;legalName:string;gender:"male"|"female"|null};
const listen=()=>()=>{};
const staging=()=>window.location.hostname==="tos.staging.pinohouse.art";
const server=()=>false;
export function TosWishRuntime(p:Props){const enabled=useSyncExternalStore(listen,staging,server);return enabled?<Scope key={p.centerId+":"+p.learnerId} {...p}/>:null;}
function Scope(p:Props){
 const [actor,setActor]=useState<string|null>(null),[error,setError]=useState(""),[epoch,setEpoch]=useState(0);
 useEffect(()=>{const c=new AbortController();void readWishActor(c.signal).then(a=>{if(!c.signal.aborted)setActor(a);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không thể xác thực Wish.");});return()=>c.abort();},[epoch]);
 const host=useMemo(()=>actor&&typeof indexedDB!=="undefined"?browserTosWishHost(actor,{centerId:p.centerId,learnerId:p.learnerId}):null,[actor,p.centerId,p.learnerId]);
 if(!host)return error||actor?<div role="alert">{error||"Không thể lưu giao dịch Wish an toàn."}<TosVNextButton variant="secondary" onClick={()=>{setActor(null);setError("");setEpoch(x=>x+1);}}>Thử lại</TosVNextButton></div>:<p role="status">Đang xác thực Wish…</p>;
 return <TosWishExecution key={actor+":"+epoch} {...p} host={host}/>;
}
