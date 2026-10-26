"use client";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { PROTOTYPE_KEYS,PROTOTYPE_SECTIONS,prototypeModules,prototypeRoute,prototypeRows,prototypeCounts,type PrototypeModule } from "@/lib/ho-prototype-fixtures";
import "./prototype.css";
const source:BoWorkspaceSource={
 modules:prototypeModules, surface:"ho",readOnly:true,
 routeForModule:key=>prototypeRoute(key),
 scopeLabel:(key,options)=>{
  const counts=prototypeCounts(key as PrototypeModule,options.section);
  return "Dữ liệu hiển thị: "+counts.shown+" bản ghi · "
   +counts.real+" mẫu kiểm thử từ staging · "+counts.mock+" bản ghi mô phỏng · Không ghi dữ liệu";
 },
 async load(key,_fetcher,options){
  if(!PROTOTYPE_KEYS.includes(key as PrototypeModule))return [];
  return prototypeRows(key as PrototypeModule,options.section);
 },
};
export function HoPrototypeWorkspace({module,section}:{module:PrototypeModule;section:string}){
 const tabs=PROTOTYPE_SECTIONS[module];
 return <BoRegistrationWorkspace source={source} moduleKey={module} options={{section}}
  currentUser={{displayName:"Founder Preview"}} headerContent={
   <div className="prototype-extras" data-prototype="true">
    <div className="prototype-notice">
     <span className="prototype-stamp">PROTOTYPE · UI/UX</span>
     <span>Giao diện dùng BO V2.5 Design System thực tế. Bản ghi có nhãn nguồn <strong>Staging · QA</strong> hoặc <strong>Mô phỏng</strong>; không phải dữ liệu Production.</span>
     <a href="/ho/centers" title="Quay lại HO runtime" className="prototype-live-link">HO Runtime</a>
    </div>
    {tabs?.length?<nav className="prototype-tabs" aria-label="Prototype data views">
     {tabs.map(tab=><a key={tab.value} className={"prototype-tab "+((section||"all")===tab.value?"active":"")}
       href={prototypeRoute(module,tab.value)} aria-current={section===tab.value?"page":undefined}>{tab.label}</a>)}
    </nav>:null}
   </div>
  }/>;
}
