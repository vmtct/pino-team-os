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
 const basePath=location.pathname;
 function projectedLink(){const u=new URL(location.href),q=u.searchParams;if(u.pathname!==basePath||q.size!==2||q.getAll("post").length!==1||q.getAll("photo").length!==1)return null;const key=q.get("post"),photo=q.get("photo");if(!/^[A-Za-z0-9_-]{1,80}$/.test(key)||!/^[1-5]$/.test(photo))return null;const dialog=Array.from(root.querySelectorAll("[data-portfolio-viewer]")).find(x=>x.dataset.portfolioViewer===key);const n=Number(photo)-1;return dialog&&n<dialog.querySelectorAll("[data-portfolio-slide]").length?{dialog,n}:null;}
 function urlFor(dialog,n){const u=new URL(location.href);u.search="";u.hash="";u.searchParams.set("post",dialog.dataset.portfolioViewer);u.searchParams.set("photo",String(n+1));return u.pathname+u.search;}
 function cleanURL(){if(location.search||location.hash)history.replaceState(null,"",basePath);}
 function openViewer(dialog,n,button,push){if(active?.open&&active!==dialog){active.close();}active=dialog;opener=button||Array.from(root.querySelectorAll("[data-portfolio-open]")).find(x=>x.dataset.portfolioOpen===dialog.dataset.portfolioViewer);show(n);if(!active.open)active.showModal();active.querySelector("[data-portfolio-close]").focus();if(push)history.pushState({pinerPortfolio:true},"",urlFor(active,index));}
 function syncURL(){const link=projectedLink();if(link){openViewer(link.dialog,link.n,null,false);}else if(active?.open){active.close();}}
 function slides(){return Array.from(active?.querySelectorAll("[data-portfolio-slide]")??[]);}
 function show(n){const all=slides();if(!all.length)return;index=Math.max(0,Math.min(all.length-1,n));all.forEach((el,i)=>{el.hidden=i!==index;});active.querySelector("[data-portfolio-counter]").textContent=(index+1)+" / "+all.length;const prev=active.querySelector("[data-portfolio-prev]"),next=active.querySelector("[data-portfolio-next]"),focus=document.activeElement;if(active.open&&((focus===prev&&index===0)||(focus===next&&index===all.length-1)))active.querySelector("[data-portfolio-close]").focus();prev.disabled=index===0;next.disabled=index===all.length-1;if(active.open&&projectedLink())history.replaceState(history.state,"",urlFor(active,index));}
 function dismiss(){if(active?.open)active.close();}
 function clear(){cleanURL();dismiss();active=null;opener=null;const state=document.createElement("div");state.className="empty-state portfolio-state";state.dataset.portfolioState="loading";state.setAttribute("role","status");state.textContent="Đang tải nội dung cho hồ sơ đã chọn…";root.replaceChildren(state);root.dataset.portfolioState="loading";}
 root.addEventListener("click",e=>{const open=e.target.closest("[data-portfolio-open]");if(open){const next=Array.from(root.querySelectorAll("[data-portfolio-viewer]")).find(x=>x.dataset.portfolioViewer===open.dataset.portfolioOpen);if(!next)return;openViewer(next,Number(open.dataset.portfolioIndex)||0,open,true);return;}if(!active)return;if(e.target.closest("[data-portfolio-close]"))dismiss();else if(e.target.closest("[data-portfolio-prev]"))show(index-1);else if(e.target.closest("[data-portfolio-next]"))show(index+1);});
 for(const dialog of root.querySelectorAll("dialog")){dialog.addEventListener("close",()=>{if(active===dialog){active=null;opener?.focus();opener=null;if(projectedLink()){if(history.state?.pinerPortfolio)history.back();else cleanURL();}}});dialog.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();show(index+(e.key==="ArrowLeft"?-1:1));}});const track=dialog.querySelector(".portfolio-slides");track?.addEventListener("pointerdown",e=>{startX=e.clientX;});track?.addEventListener("pointercancel",()=>{startX=null;});track?.addEventListener("pointerup",e=>{if(startX!==null&&Math.abs(e.clientX-startX)>45)show(index+(e.clientX<startX?1:-1));startX=null;});}
 chrome.addEventListener("piner:select-student",e=>{if(e.detail?.id!==initial)clear();});
 window.addEventListener("popstate",syncURL);
 queueMicrotask(()=>{if(selected()!==initial)clear();else syncURL();});
 window.addEventListener("pagehide",()=>{dismiss();root.hidden=true;});
 window.addEventListener("pageshow",e=>{if(e.persisted)location.reload();});
})();
`;
