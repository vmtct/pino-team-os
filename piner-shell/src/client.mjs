export const CLIENT=String.raw`
(function(){
 "use strict";
 var shell=document.querySelector(".member");
 if(!shell)return;
 var scroller=shell.querySelector(".scroll-content"),header=shell.querySelector(".app-header"),footer=shell.querySelector(".bottom-nav");
 var last=scroller.scrollTop,travel=0,locked=0;
 function setHidden(hidden){
   shell.dataset.chromeCollapsed=hidden?"true":"false";
   header.inert=!!hidden;footer.inert=!!hidden;
   header.setAttribute("aria-hidden",String(!!hidden));footer.setAttribute("aria-hidden",String(!!hidden));
 }
 function onScroll(){
   var y=scroller.scrollTop,delta=y-last;last=y;
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
 });
 panel.querySelector("[data-dismiss]").addEventListener("click",function(){close();trigger.focus();});
 document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!panel.hidden){close();trigger.focus();}});
 document.addEventListener("pointerdown",function(e){if(!panel.hidden&&!panel.contains(e.target)&&!trigger.contains(e.target))close();});
})();
`;
