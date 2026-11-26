"use client";
import {useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "../../components/registration/BoRegistrationWorkspace";
import {BoStaffsViews,parseStaffsView,staffDirectoryViewHref,staffsViewRows,type StaffsView} from "../../components/registration/BoStaffsViews";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {staffDirectoryModule} from "./staff-directory-model";
/** PAP-2411: identical native presentation for authorized live data and isolated review data. */
export function StaffDirectoryWorkspace({currentUser,options,centerId,source,registration}:{
  currentUser:{displayName:string|null};options:Record<string,string>;centerId:string;
  source:BoWorkspaceSource;registration:ReactNode;
}) {
  const [view,setView]=useState<StaffsView>(()=>parseStaffsView(options.view));
  useEffect(()=>{
    const sync=()=>setView(parseStaffsView(new URLSearchParams(window.location.search).get("view")));
    window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);
  },[]);
  const selectView=(next:StaffsView)=>{
    if(next===view)return;
    window.history.pushState(null,"",staffDirectoryViewHref(window.location.pathname,window.location.search,next));
    setView(next);
  };
  const scopedOptions=useMemo(()=>({...options,centerId,view}),[options,centerId,view]);
  const presentation=useMemo<BoWorkspaceSource>(()=>({
    ...source,modules:{...source.modules,staffs:staffDirectoryModule},
    isModuleReadOnly:key=>key==="staffs"||source.isModuleReadOnly?.(key)===true,
    scopeLabel:(key,requested)=>key==="staffs"&&view==="register"?"C\u01a1 s\u1edf \u0111\u00e3 ch\u1ecdn":source.scopeLabel(key,requested),
    async load(key,fetcher,requested){
      const rows=await source.load(key,fetcher,requested);
      return key==="staffs"?staffsViewRows(rows,view):rows;
    },
  }),[source,view]);
  const tabs=<BoStaffsViews selected={view} onSelect={selectView}/>;
  return <BoRegistrationWorkspace key={"staffs:"+view+":"+centerId} currentUser={currentUser} source={presentation} moduleKey="staffs" options={scopedOptions}
    headerContent={tabs} content={view==="register"?<RegistrationContent tabs={tabs}>{registration}</RegistrationContent>:undefined}/>;
}
function RegistrationContent({tabs,children}:{tabs:ReactNode;children:ReactNode}){
  const menu=useContext(TddHostMenu);
  return <><div className="page-heading"><div className="page-heading-left">{menu("staff-register-menu-btn")}<h1>{"Nh\u00e2n s\u1ef1"}</h1></div></div>{tabs}{children}</>;
}
