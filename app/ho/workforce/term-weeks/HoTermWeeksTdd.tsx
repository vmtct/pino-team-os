"use client";
import '@pino/design-system/bo-tokens.css';
import '@pino/design-system/tos-tokens.css';
import '@pino/design-system/components.css';
import {useEffect,useState} from 'react';
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from '@/lib/workspace-adapters';
import {browserTddNavigation,type AdapterNavigation} from '@/lib/workspace-adapters/navigation';
import {surfaceSession} from '@/lib/workspace-adapters/session';
import {TddRegistry} from '@/lib/workspace-schema';
import {SurfaceWorkspace} from '@/app/components/workspace-adapters/SurfaceWorkspace';
import {HoWorkspace} from '@/app/ho/HoWorkspace';
import {loadWeek} from '@/lib/ho-termweek-client';
import type {WeekAction} from '@/lib/ho-termweek-contract';
import {termWeekDefinition,termWeekFields,termWeekProvider,termWeekInitialQuery,termWeekQuery,verifyGlobalWeekExtensionApproval} from './schema';
import {HoGlobalTermWeekEditor} from './HoGlobalTermWeekEditor';
type F=typeof termWeekFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>;fetcher:typeof fetch;query:typeof termWeekQuery};
export function HoTermWeeksTdd(){
 const [ready,setReady]=useState<Ready|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0),[refresh,setRefresh]=useState(0);
 const [editor,setEditor]=useState<{action:WeekAction;id?:string}|null>(null);
 useEffect(()=>{const controller=new AbortController(),session=surfaceSession('HO',undefined);let adapter:Ready['adapter']|undefined;
  void createHoTddAdapter({registry:new TddRegistry(verifyGlobalWeekExtensionApproval),definition:termWeekDefinition,provider:termWeekProvider},controller.signal).then(result=>{adapter=result;if(controller.signal.aborted){result.dispose();return;}const query=termWeekInitialQuery(new URLSearchParams(location.search).get('termId'));setReady({adapter:result,navigation:browserTddNavigation('HO','termWeeks',query),fetcher:session.transport,query});}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>{controller.abort();adapter?.dispose();session.dispose();};
 },[retry]);
 function open(action:WeekAction){const id=ready?.navigation.read().recordId;if(action==='create'||id)setEditor({action,id:action==='create'?undefined:id});}
 const content=error?<p role="alert">Không tải được Global TermWeek. <button type="button" onClick={()=>{setReady(null);setError(false);setRetry(n=>n+1);}}>Thử lại</button></p>:!ready?<p role="status">Đang tải Global TermWeek…</p>:<>
  <SurfaceWorkspace key={refresh} adapter={ready.adapter} navigation={ready.navigation} initialQuery={ready.query}
   actionBindings={{'week.create':{run:()=>open('create')},'week.update':{run:()=>open('update')},'week.delete':{run:()=>open('delete')},'week.lock':{run:()=>open('lock')},'week.parent':{run:async()=>{const id=ready.navigation.read().recordId;if(id){const week=await loadWeek(id,ready.fetcher,new AbortController().signal);window.location.assign('/ho/operating-cycle/global-terms?record='+week.termId);}}}}}/>
  {editor&&<HoGlobalTermWeekEditor key={editor.action+editor.id} action={editor.action} id={editor.id} fetcher={ready.fetcher} onClose={()=>setEditor(null)} onSaved={()=>{if(editor.action==='delete')ready.navigation.change({kind:'table',tab:'overview',query:ready.navigation.read().query});setEditor(null);setRefresh(n=>n+1);}}/>}
 </>;
 return <HoWorkspace module="termWeeks" content={content}/>;
}
