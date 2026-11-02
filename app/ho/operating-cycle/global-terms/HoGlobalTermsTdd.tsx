"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect,useState } from "react";
import Link from "next/link";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { surfaceSession } from "@/lib/workspace-adapters/session";
import { TddRegistry } from "@/lib/workspace-schema";
import { loadGlobalTerm } from "@/lib/ho-global-terms-client";
import { globalTermDefinition,globalTermFields,globalTermProvider,globalTermQuery,verifyGlobalTermApproval } from "./schema";
import { HoGlobalTermEditor } from "./HoGlobalTermEditor";
/** Core calendar dates are ISO day-only strings. Display without timezone conversion. */
function formatTermDate(value:string){return value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4);}
type F=typeof globalTermFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>;fetcher:typeof fetch};
export function HoGlobalTermsTdd(){
  const [ready,setReady]=useState<Ready|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0),[refresh,setRefresh]=useState(0);
  const [editor,setEditor]=useState<{action:"create"|"update"|"delete";id?:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();let adapter:Ready["adapter"]|undefined;
    const session=surfaceSession("HO",undefined);
    void createHoTddAdapter({registry:new TddRegistry(verifyGlobalTermApproval),definition:globalTermDefinition,provider:globalTermProvider},controller.signal).then(result=>{
      adapter=result;if(controller.signal.aborted){result.dispose();return;}
      setReady({adapter:result,navigation:browserTddNavigation("HO","globalTerms",globalTermQuery),fetcher:session.transport});
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>{controller.abort();adapter?.dispose();session.dispose();};
  },[retry]);
  function open(action:"create"|"update"|"delete") {const id=ready?.navigation.read().recordId;if(action==="create"||id)setEditor({action,id:action==="create"?undefined:id});}
  const content=error?<p role="alert">Không tải được Global Terms. <button type="button" onClick={()=>{setReady(null);setError(false);setRetry(n=>n+1);}}>Thử lại</button></p>:!ready?<p role="status">Đang tải Global Terms…</p>:<>
    <SurfaceWorkspace key={refresh} adapter={ready.adapter} navigation={ready.navigation} initialQuery={globalTermQuery}
      actionBindings={{"term.create":{run:()=>open("create")},"term.edit":{run:()=>open("update")},"term.delete":{run:()=>open("delete")}}}
      businessLoaders={{"ho-global-term-weeks":async(_slot,record,_context,signal)=>{
        const term=await loadGlobalTerm(record.id,ready.fetcher,signal);
        return <section className="v24-prop-section" aria-label="Tuần thuộc Global Term">
          <div className="v24-section-heading">
            <h4>Tuần trong học kỳ</h4><span className="settings-hint">{term.weeks.length} tuần</span>
          </div>
          {term.weeks.length
            ? <div role="list">
                {term.weeks.map(w=><div className="v24-prop-item" role="listitem" key={w.id}>
                  <span className="v24-prop-key">{w.code}</span>
                  <Link className="v24-prop-value"
                    href={"/ho/workforce/term-weeks?record="+w.id} prefetch={false}
                    aria-label={"Xem "+w.code+" từ "+formatTermDate(w.startDate)+" đến "+formatTermDate(w.endDate)}>
                    <span>{formatTermDate(w.startDate)} – {formatTermDate(w.endDate)}</span>
                    <span className="settings-hint">{w.rhythmKey}</span>
                  </Link>
                </div>)}
              </div>
            : <div className="v24-audit-empty" role="status">Chưa có tuần trong học kỳ này.</div>}
          <p className="settings-hint"><Link href="/ho/workforce/term-weeks" prefetch={false}>Đi đến quản lý Global TermWeeks</Link></p>
        </section>;
      }}} />
    {editor&&<HoGlobalTermEditor key={editor.action+editor.id} action={editor.action} id={editor.id} fetcher={ready.fetcher} onClose={()=>setEditor(null)} onSaved={()=>{
      if(editor.action==="delete")ready.navigation.change({kind:"table",tab:"overview",query:ready.navigation.read().query});
      setEditor(null);setRefresh(n=>n+1);
    }}/>}
  </>;
  return <HoWorkspace module="globalTerms" content={content}/>;
}
