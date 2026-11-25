export const PORTFOLIO_CLIENT=String.raw`
(function(){
 "use strict";
 const root=document.querySelector(".portfolio"),chrome=document.querySelector("[data-member-chrome]");
 const retry=document.querySelector("[data-portfolio-retry]");
 if(retry)retry.addEventListener("click",()=>chrome?.dispatchEvent(new CustomEvent("piner:portfolio-retry",{bubbles:true})));
 if(!root||!chrome)return;
 const selected=()=>chrome.querySelector("[data-student-id][aria-selected=true]")?.dataset.studentId??null;
 const initial=selected();
 let active=null,index=0,opener=null,startX=null;
 function slides(){return Array.from(active?.querySelectorAll("[data-portfolio-slide]")??[]);}
 function show(n){const all=slides();if(!all.length)return;index=Math.max(0,Math.min(all.length-1,n));all.forEach((el,i)=>{el.hidden=i!==index;});active.querySelector("[data-portfolio-counter]").textContent=(index+1)+" / "+all.length;active.querySelector("[data-portfolio-prev]").disabled=index===0;active.querySelector("[data-portfolio-next]").disabled=index===all.length-1;}
 function dismiss(){if(active?.open)active.close();}
 function clear(){dismiss();active=null;opener=null;const state=document.createElement("div");state.className="empty-state portfolio-state";state.dataset.portfolioState="loading";state.setAttribute("role","status");state.textContent="Đang tải nội dung cho hồ sơ đã chọn…";root.replaceChildren(state);root.dataset.portfolioState="loading";}
 root.addEventListener("click",e=>{const open=e.target.closest("[data-portfolio-open]");if(open){const next=Array.from(root.querySelectorAll("[data-portfolio-viewer]")).find(x=>x.dataset.portfolioViewer===open.dataset.portfolioOpen);if(!next)return;opener=open;active=next;show(Number(open.dataset.portfolioIndex)||0);active.showModal();active.querySelector("[data-portfolio-close]").focus();return;}if(!active)return;if(e.target.closest("[data-portfolio-close]"))dismiss();else if(e.target.closest("[data-portfolio-prev]"))show(index-1);else if(e.target.closest("[data-portfolio-next]"))show(index+1);});
 for(const dialog of root.querySelectorAll("dialog")){dialog.addEventListener("close",()=>{if(active===dialog){active=null;opener?.focus();opener=null;}});dialog.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();show(index+(e.key==="ArrowLeft"?-1:1));}});const track=dialog.querySelector(".portfolio-slides");track?.addEventListener("pointerdown",e=>{startX=e.clientX;});track?.addEventListener("pointercancel",()=>{startX=null;});track?.addEventListener("pointerup",e=>{if(startX!==null&&Math.abs(e.clientX-startX)>45)show(index+(e.clientX<startX?1:-1));startX=null;});}
 chrome.addEventListener("piner:select-student",e=>{if(e.detail?.id!==initial)clear();});
 queueMicrotask(()=>{if(selected()!==initial)clear();});
 window.addEventListener("pagehide",()=>{dismiss();root.hidden=true;});
})();
`;
