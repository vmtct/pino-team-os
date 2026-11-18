"use client";
import {useEffect,useState} from "react";
import {formatPinoDateTime} from "@/lib/pino-datetime";
import {fetchWorldHistory,type WorldHistory} from "./world-runtime-client";
import styles from "./WorldUiShell.module.css";
export function HoWorldHistory({worldId}:{worldId:string}){
 const [result,setResult]=useState<WorldHistory|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 useEffect(()=>{const ctl=new AbortController();void fetchWorldHistory(worldId,fetch,ctl.signal).then(r=>{if(!ctl.signal.aborted)setResult(r)}).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải lịch sử.")});return()=>ctl.abort()},[worldId,retry]);
 if(error)return <div role="alert">{error} <button type="button" className="secondary-btn" onClick={()=>{setError("");setResult(null);setRetry(n=>n+1)}}>Thử lại</button></div>;
 if(!result)return <p role="status" className={styles.empty}>Đang tải lịch sử…</p>;
 if(!result.events.length)return <p role="status" className={styles.empty}>Chưa có lịch sử World.</p>;
 return <section className="grid-card"><div className="table-scroll" tabIndex={0} aria-label="Lịch sử World"><table className={styles.compactTable}><thead><tr><th scope="col">Thời gian</th><th scope="col">Hoạt động</th><th scope="col">Người thực hiện</th></tr></thead><tbody>{result.events.map(e=><tr key={e.id}><td>{formatPinoDateTime(e.occurredAt)}</td><td>{e.label}</td><td>{e.actorName??"—"}</td></tr>)}</tbody></table></div>{result.truncated&&<p role="status" className="table-meta">Hiển thị 100 hoạt động gần nhất.</p>}</section>;
}
