"use client";

/** PAP-1936 · TOS Runtime: coordinate top/bottom chrome on the actual scroll owner.
 * Only DOM presentation changes; never touches app navigation, auth or data.
 */
import {useEffect,useRef} from "react";

const navigation = '[data-tos-shared="bottom-nav"],[data-tos-slot~="nav"],[data-tos-slot~="bottomNav"],[data-tos-nav="footer"]';
const chrome = '[data-tos-app-header],[data-tos-nav="header"]';

export default function ScrollAwareChrome(){
 const anchor=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const root=anchor.current?.parentElement;
  if(!root)return;
  const previous=new WeakMap<HTMLElement,number>();
  let lastScroller:HTMLElement|null=null;
  let down=0,up=0,hidden=false,suppressUntil=0;
  root.dataset.tosScrollChrome="visible";

  const setHidden=(value:boolean)=>{
   if(value===hidden)return;
   const focused=document.activeElement;
   if(value&&focused instanceof Element&&focused.matches(":focus-visible")&&
      focused.closest(chrome+","+navigation))return;
   hidden=value;down=0;up=0;
   suppressUntil=performance.now()+260;
   root.dataset.tosScrollChrome=value?"hidden":"visible";
  };
  const reveal=()=>setHidden(false);
  const onScroll=(event:Event)=>{
   const source=event.target;
   const element=source===document?document.scrollingElement:source;
   if(!(element instanceof HTMLElement))return;
   const pageScroll=element===document.documentElement||element===document.body;
   if(!pageScroll&&!root.contains(element))return;
   if(pageScroll){
    const r=root.getBoundingClientRect();
    if(r.bottom<=0||r.top>=innerHeight)return;
   }
   if(element.closest('[role="dialog"],[data-tos-shared="sheet"],[data-tos-shared="modal-root"]'))return;
   if(element.scrollHeight-element.clientHeight<40)return;
   const y=element.scrollTop,old=previous.get(element)??0;
   previous.set(element,y);
   if(lastScroller!==element){lastScroller=element;down=0;up=0;}
   if(y<=4){reveal();return;}
   if(performance.now()<suppressUntil)return;
   const delta=y-old;
   if(Math.abs(delta)<2||Math.abs(delta)>element.clientHeight)return;
   if(delta>0){
    up=0;down+=Math.min(delta,60);
    if(y>20&&down>=18)setHidden(true);
   }else{
    down=0;up+=Math.min(-delta,60);
    if(up>=12)reveal();
   }
  };
  const onClick=(event:MouseEvent)=>{
   if(event.target instanceof Element&&event.target.closest(navigation+', [role="tablist"]'))reveal();
  };
  const onFocus=(event:FocusEvent)=>{
   if(event.target instanceof Element&&event.target.closest(chrome+','+navigation+',[role="dialog"]'))reveal();
  };
  const hasNav=()=>Boolean(root.querySelector(navigation));
  let navPresent=hasNav();
  const mutation=new MutationObserver(()=>{
   const current=hasNav();
   if(current&&!navPresent){reveal();suppressUntil=performance.now()+420;}
   navPresent=current;
  });
  mutation.observe(root,{childList:true,subtree:true});
  document.addEventListener("scroll",onScroll,true);
  root.addEventListener("click",onClick,true);
  root.addEventListener("focusin",onFocus,true);
  return()=>{
   mutation.disconnect();
   document.removeEventListener("scroll",onScroll,true);
   root.removeEventListener("click",onClick,true);
   root.removeEventListener("focusin",onFocus,true);
   delete root.dataset.tosScrollChrome;
  };
 },[]);
 return <span ref={anchor} hidden data-tos-scroll-controller="PAP-1936"/>;
}
