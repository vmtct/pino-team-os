"use client";
import {useEffect,useRef,type ReactNode,type HTMLAttributes,type ButtonHTMLAttributes} from "react";
import ui from "./primitives.module.css";

function useModalIsolation(ref:React.RefObject<HTMLElement|null>){
 useEffect(()=>{
  const restore:{element:HTMLElement;inert:boolean;hidden:string|null}[]=[];
  let current=ref.current;if(!current)return;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
  while(current.parentElement&&current!==document.body){
   for(const sibling of Array.from(current.parentElement.children))if(sibling!==current&&sibling instanceof HTMLElement){
    restore.push({element:sibling,inert:sibling.inert,hidden:sibling.getAttribute("aria-hidden")});sibling.inert=true;sibling.setAttribute("aria-hidden","true");
   }current=current.parentElement;
  }
  return()=>{for(const item of restore){item.element.inert=item.inert;if(item.hidden===null)item.element.removeAttribute("aria-hidden");else item.element.setAttribute("aria-hidden",item.hidden)}document.body.style.overflow=overflow};
 },[ref]);
}

export type NavOption={id:string;label:string;icon:ReactNode};
export function AppBottomNav({items,active,onChange,label,tabPanelPrefix}:{
 items:NavOption[];active:string;onChange:(id:string)=>void;label:string;tabPanelPrefix?:string;
}){
 if(items.length>5)throw new Error("TOS BottomNav supports at most 5 tabs");
 return <nav role={tabPanelPrefix?"tablist":undefined} className={ui.bottomNav} aria-label={label} data-tos-shared="bottom-nav">
 {items.map(item=><button type="button" key={item.id} role={tabPanelPrefix?"tab":undefined} id={tabPanelPrefix?`${tabPanelPrefix}-tab-${item.id}`:undefined} aria-controls={tabPanelPrefix?`${tabPanelPrefix}-panel-${item.id}`:undefined} aria-selected={tabPanelPrefix?item.id===active:undefined} aria-current={item.id===active?"page":undefined} onClick={()=>onChange(item.id)}>
 <span className={ui.navIcon} aria-hidden="true">{item.icon}</span><span className={ui.navText}>{item.label}</span></button>)}
 </nav>;
}
export function AppSectionHeading({title,meta}:{
 title:string;meta?:ReactNode
}){return <div className={ui.sectionHeading} data-tos-shared="section-heading"><h3>{title}</h3>{meta&&<small>{meta}</small>}</div>}
export function AppCard({children,className="",...props}:HTMLAttributes<HTMLElement>){
 return <article {...props} className={[ui.card,className].filter(Boolean).join(" ")} data-tos-shared="card">{children}</article>
}

export function AppSheet({title,onClose,children,label}:{
 title:string;onClose:()=>void;children:ReactNode;label?:string
}){
 const dialogRef=useRef<HTMLElement>(null);
 useModalIsolation(dialogRef);
 const currentClose=useRef(onClose);
 useEffect(()=>{currentClose.current=onClose},[onClose]);
 useEffect(()=>{
  const dlg=dialogRef.current;if(!dlg)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;

  const focusable=()=>Array.from(dlg.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(x=>x.getClientRects().length>0);
  (focusable()[0]??dlg).focus();
  const keydown=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();currentClose.current();return}
   if(e.key!=="Tab")return;
   const items=focusable();const first=items[0],last=items.at(-1);
   if(!first||!last){e.preventDefault();dlg.focus();return}
   if(e.shiftKey&&(document.activeElement===first||!dlg.contains(document.activeElement))){e.preventDefault();last.focus()}
   if(!e.shiftKey&&(document.activeElement===last||!dlg.contains(document.activeElement))){e.preventDefault();first.focus()}
  };
  document.addEventListener("keydown",keydown);
  return ()=>{document.removeEventListener("keydown",keydown);previous?.focus()}
 },[]);
 return <div className={ui.overlay} role="presentation" data-tos-shared="sheet"
   onMouseDown={e=>{if(e.target===e.currentTarget)currentClose.current()}}>
   <section ref={dialogRef} className={ui.sheet} role="dialog" aria-modal="true" tabIndex={-1} aria-label={label||title}>
     <header className={ui.sheetHeader}><strong>{title}</strong><button aria-label="Đóng" title="Đóng" type="button" onClick={()=>currentClose.current()}>✕</button></header>{children}
   </section>
 </div>
}
export function AppToast({message,children,className,...props}:HTMLAttributes<HTMLDivElement>&{message?:string}){
 return (message||children)?<div {...props} role="status" aria-live="polite" className={[ui.toast,className].filter(Boolean).join(" ")} data-tos-shared="toast">{children??message}</div>:null
}

export type TosButtonVariant="primary"|"secondary"|"quiet"|"destructive";
export function AppButton({variant="primary",children,className,...props}:
 ButtonHTMLAttributes<HTMLButtonElement>&{variant?:TosButtonVariant}){
 const v=variant==="primary"?ui.button:variant==="secondary"?ui.buttonSecondary:variant==="quiet"?ui.buttonQuiet:ui.buttonDestructive;
 return <button {...props} type={props.type??"button"} className={[v,className].filter(Boolean).join(" ")} data-tos-shared="button">{children}</button>
}
export type TosStatusKind="neutral"|"success"|"warning"|"danger"|"info";
export function AppStatusBadge({kind="neutral",children}:{kind?:TosStatusKind;children:ReactNode}){
 return <span className={ui.badge} data-tos-status={kind} data-tos-shared="badge">{children}</span>
}
export function AppField({label,children,hint,error}:{
 label:string;children:ReactNode;hint?:string;error?:string
}){
 return <label className={ui.field} data-tos-shared="field">
  <span className={ui.fieldLabel}>{label}</span>
  <div>{children}</div>
  {hint&&<small className={ui.fieldHint}>{hint}</small>}
  {error&&<small className={ui.fieldError} role="alert">{error}</small>}
 </label>
}

/** DS layout-only primitive: preserves existing app visual geometry. */
export function AppNavShell({label,className,children,...props}:HTMLAttributes<HTMLElement>&{label:string}){return <nav {...props} className={className} aria-label={label} data-tos-shared="nav-shell">{children}</nav>}
/** Shared modal boundary; caller retains domain validation and discard guards. */
export function AppModalRoot({children,className,onClose,...props}:HTMLAttributes<HTMLDivElement>&{
 children:ReactNode;onClose:()=>void
}){const ref=useRef<HTMLDivElement>(null);useModalIsolation(ref);
 const close=useRef(onClose);
 useEffect(()=>{close.current=onClose},[onClose]);
 useEffect(()=>{
  const root=ref.current;if(!root)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const target=()=>root.querySelector<HTMLElement>('[role="alertdialog"]')??root.querySelector<HTMLElement>('[role="dialog"]')??root;
  const controls=()=>Array.from(target().querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0);
  (controls()[0]??target()).focus();
  const key=(event:KeyboardEvent)=>{
   if(event.defaultPrevented)return;
   if(event.key==="Escape"){event.preventDefault();close.current();return}
   if(event.key!=="Tab")return;
   const items=controls(),first=items[0],last=items.at(-1);
   if(!first||!last){event.preventDefault();target().focus();return}
   if(event.shiftKey&&(document.activeElement===first||!target().contains(document.activeElement))){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||!target().contains(document.activeElement))){event.preventDefault();first.focus()}
  };
  document.addEventListener("keydown",key);
  return()=>{document.removeEventListener("keydown",key);if(previous?.isConnected)previous.focus()};
 },[]);
 return <div {...props} ref={ref} className={className} role="presentation" data-tos-shared="modal-root"
 onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>{children}</div>}
/** Station desktop rail has a separate layout variant from mobile tabs. */
export function AppNavRail({label,className,children,...props}:HTMLAttributes<HTMLElement>&{label:string}){return <nav {...props} className={className} aria-label={label} data-tos-shared="nav-rail">{children}</nav>}

/** Stable semantic DOM hooks used by shared DS layouts. */
export function createSlotKeys(styles:Readonly<Record<string,string>>){
 const reverse=new Map(Object.entries(styles).map(([slot,cssClass])=>[cssClass,slot]));
 return (classes:string|undefined|null)=>String(classes??"").split(/\s+/).map(x=>reverse.get(x)).filter(Boolean).join(" ");
}
