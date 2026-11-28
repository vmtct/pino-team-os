// PAP-2432: native event wiring for the admitted reader, not a mounted endpoint.
// Reuse the existing server renderer and viewer binder. No client auth decisions.
import {createPortfolioReadLifecycle} from "./portfolio-read-lifecycle.mjs";
import {renderPortfolio} from "./portfolio-view.mjs";
export function bindNativePortfolioLifecycle({chrome,slot,window:win,space,tab,read,bindInteractions}){
 if(chrome?.dataset?.memberSession!=="true"||!slot||!win||!["house","mytime"].includes(space)||!["home","grid"].includes(tab)||typeof read!=="function"||typeof bindInteractions!=="function")return null;
 const member=chrome.querySelector(".member");
 if(member?.dataset?.pinerSpace!==space||member?.dataset?.unifiedTab!==tab)return null;
 const options=()=>Array.from(chrome.querySelectorAll("[data-student-id]"));
 const selected=()=>space==="house"?options().find(x=>x.getAttribute("aria-selected")==="true")?.dataset.studentId??null:null;
 let disposeInteractions=null,closed=false,scheduled=false;
 const lifecycle=createPortfolioReadLifecycle({space,authorizedStudents:()=>options().map(x=>x.dataset.studentId),read,render(model){
  disposeInteractions?.();disposeInteractions=null;
  // HTML is produced only by the existing escaping renderer, never by the read port.
  slot.innerHTML=renderPortfolio(space,tab,model)??"";
  if(model.state==="ready")disposeInteractions=bindInteractions(slot)??null;
 }});
 const refresh=()=>{if(!closed)return lifecycle.select(selected());};
 function selectionChanged(){if(space!=="house"||closed||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;void refresh();});}
 function retry(){if(!closed)void lifecycle.retry();}
 function retryClick(e){if(e.target?.closest?.("[data-portfolio-retry]"))retry();}
 function invalidate(){
  if(closed)return;closed=true;lifecycle.invalidate();
  chrome.removeEventListener("piner:select-student",selectionChanged);
  chrome.removeEventListener("piner:portfolio-retry",retry);
  chrome.removeEventListener("piner:sign-out",invalidate);
  slot.removeEventListener("click",retryClick);
  win.removeEventListener("pagehide",invalidate);
 }
 chrome.addEventListener("piner:select-student",selectionChanged);
 chrome.addEventListener("piner:portfolio-retry",retry);
 chrome.addEventListener("piner:sign-out",invalidate);
 slot.addEventListener("click",retryClick);
 win.addEventListener("pagehide",invalidate);
 // The existing chrome restores the selected option in its own synchronous handler.
 selectionChanged();if(space==="mytime")void refresh();
 return Object.freeze({invalidate});
}
