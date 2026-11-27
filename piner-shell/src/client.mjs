import {PORTFOLIO_CLIENT} from "./portfolio-client.mjs";
export const CLIENT=PORTFOLIO_CLIENT+String.raw`
(function(){
 "use strict";
 // PAP-2194: presentation events only; session/context adapter owns side effects.
 var chrome=document.querySelector("[data-member-chrome]");
 if(chrome){
   var pressed=null;
   function clearPress(){if(pressed){pressed.removeAttribute("data-pressed");pressed=null;}}
   chrome.addEventListener("pointerdown",function(e){var card=e.target.closest(".program-card");if(!card||e.button!==0)return;clearPress();pressed=card;card.setAttribute("data-pressed","true");});
   window.addEventListener("pointerup",clearPress);
   window.addEventListener("pointercancel",clearPress);
   window.addEventListener("blur",clearPress);
   chrome.addEventListener("click",function(e){
     var sign=e.target.closest("[data-sign-out]");
     if(sign){chrome.dispatchEvent(new CustomEvent("piner:sign-out",{bubbles:true}));return;}
     var option=e.target.closest("[data-student-id]");
     if(!option)return;
     chrome.dispatchEvent(new CustomEvent("piner:select-student",{bubbles:true,detail:{id:option.dataset.studentId}}));
   });
 }
 // PAP-2194: bind only validated Staging chrome, never the synthetic view model.
 if(chrome&&chrome.dataset.memberSession==="true"){
  var key="piner:afterschool:selected-student",pending=false;
  function saved(){try{return sessionStorage.getItem(key);}catch{return null;}}
  function save(id){try{if(id)sessionStorage.setItem(key,id);else sessionStorage.removeItem(key);}catch{}}
  function restore(){
   if(!chrome.querySelector(".member[data-piner-space=house]"))return;
   var opts=Array.from(chrome.querySelectorAll("[data-student-id]"));
   var choice=opts.find(function(x){return x.dataset.studentId===saved();})||(opts.length===1?opts[0]:null);
   if(choice)save(choice.dataset.studentId);else save(null);
   opts.forEach(function(x){x.setAttribute("aria-selected",String(x===choice));});
   var trigger=chrome.querySelector(".profile-switch");
   if(trigger){trigger.querySelector("span:nth-child(2)").textContent=choice?choice.querySelector(".student-label strong").textContent:"Chọn học viên";trigger.querySelector(".avatar").textContent=choice?choice.querySelector(".student-avatar").textContent:"?";}
  }
  function goLogin(){save(null);location.replace("/login");}
  function status(message){var el=chrome.querySelector("[data-member-status]");if(!el){el=document.createElement("p");el.dataset.memberStatus="true";el.setAttribute("role","alert");var target=chrome.querySelector(".member-profile")||chrome.querySelector(".member-actions");target?.append(el);}el.textContent=message;}
  async function signOut(){
   if(pending)return;pending=true;var buttons=Array.from(chrome.querySelectorAll("[data-sign-out]"));buttons.forEach(function(x){x.disabled=true;x.setAttribute("aria-busy","true");});status("");
   try{
    var opts={credentials:"same-origin",mode:"cors",referrerPolicy:"strict-origin",cache:"no-store",redirect:"error"};
    var session=await fetch("/api/piner/afterschool/session",{...opts,headers:{Accept:"application/json"}});
    if(session.status===401||session.status===409){goLogin();return;}
    if(!session.ok)throw Error("session");var data=(await session.json())?.data;
    if(data?.authenticated!==true||typeof data.csrfToken!=="string"||!/^[A-Za-z0-9_-]{22}$/.test(data.csrfToken))throw Error("session");
    var response=await fetch("/api/piner/afterschool/logout",{...opts,method:"POST",headers:{Accept:"application/json","Content-Type":"application/json","X-Pino-CSRF":data.csrfToken},body:"{}"});
    if(response.status!==204&&response.status!==401)throw Error("logout");goLogin();
   }catch{status("Chưa thể đăng xuất. Vui lòng thử lại.");}finally{pending=false;buttons.forEach(function(x){x.disabled=false;x.removeAttribute("aria-busy");});}
  }
  restore();chrome.addEventListener("piner:select-student",function(e){if(Array.from(chrome.querySelectorAll("[data-student-id]")).some(function(x){return x.dataset.studentId===e.detail.id;})){save(e.detail.id);restore();}});
  chrome.addEventListener("piner:sign-out",signOut);
  chrome.querySelector("[data-student-retry]")?.addEventListener("click",function(){location.reload();});
  window.addEventListener("pagehide",function(){chrome.hidden=true;});
  window.addEventListener("pageshow",function(e){if(e.persisted)location.reload();});
 }
 var shell=document.querySelector(".member");
 if(!shell)return;
 var scroller=shell.querySelector(".scroll-content"),header=shell.querySelector(".app-header"),footer=shell.querySelector(".bottom-nav");
 var last=scroller.scrollTop,travel=0,locked=0;
 function setHidden(hidden){
   shell.dataset.chromeCollapsed=hidden?"true":"false";
   header.inert=hidden;
   header.setAttribute("aria-hidden",String(hidden));
 }
 function onScroll(){
   var y=scroller.scrollTop,delta=y-last;last=y;
   if(delta!==0)footer.dataset.pastCollapseThreshold=String(y>80);
   if(y<=8){travel=0;locked=0;setHidden(false);return;}
   if(performance.now()<locked||Math.abs(delta)<.75)return;
   if(Math.sign(travel)!==Math.sign(delta))travel=0;
   travel+=delta;
   if(travel>16&&y>55){
     var active=document.activeElement;
     if((header.contains(active)||footer.contains(active))&&active!==document.body)return;
     travel=0;locked=performance.now()+260;setHidden(true);
   }else if(travel< -12){
     travel=0;locked=performance.now()+260;setHidden(false);
   }
 }
 scroller.addEventListener("scroll",onScroll,{passive:true});
 var trigger=shell.querySelector(".profile-switch"),panel=shell.querySelector(".profile-panel");
 function close(){panel.hidden=true;trigger.setAttribute("aria-expanded","false");}
 trigger.addEventListener("click",function(){
   var willShow=panel.hidden;
   if(shell.dataset.chromeCollapsed==="true")setHidden(false);
   panel.hidden=!willShow;trigger.setAttribute("aria-expanded",String(willShow));
   if(chrome&&willShow)(panel.querySelector("[aria-selected=true]")||panel.querySelector("[role=option]"))?.focus();
 });
 panel.querySelector("[data-dismiss]")?.addEventListener("click",function(){close();trigger.focus();});
 if(chrome)chrome.addEventListener("piner:select-student",function(){close();trigger.focus();});
 document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!panel.hidden){close();trigger.focus();return;}if(!chrome)return;if(panel.hidden&&document.activeElement===trigger&&["ArrowDown","ArrowUp"].includes(e.key)){e.preventDefault();trigger.click();return;}if(panel.hidden)return;if(e.key==="Tab"){close();return;}var opts=Array.from(panel.querySelectorAll("[role=option]"));if(!opts.length||!["ArrowDown","ArrowUp","Home","End"].includes(e.key))return;var i=opts.indexOf(document.activeElement);e.preventDefault();opts[e.key==="Home"?0:e.key==="End"?opts.length-1:e.key==="ArrowDown"?(i+1)%opts.length:(i<=0?opts.length-1:i-1)].focus();});
 document.addEventListener("pointerdown",function(e){if(!panel.hidden&&!panel.contains(e.target)&&!trigger.contains(e.target))close();});
})();
`;
