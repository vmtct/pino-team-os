"use client";
/** PAP-939: shared TOS VNext primitives. Isolated until the six-app release. */
import {useEffect,useRef,type ButtonHTMLAttributes,type HTMLAttributes,type PropsWithChildren,type ReactNode} from "react";
import styles from "./tos-vnext.module.css";

import {SIX_TOS_APPS,appIcon,appIdentity,type TosVNextAppId,type TosVNextMode} from "./identity";
export {SIX_TOS_APPS,appIcon,appIdentity};
export type {TosVNextAppId,TosVNextMode};

export function TosVNextFrame({app,mode,children}:PropsWithChildren<{app:TosVNextAppId;mode?:TosVNextMode}>){
 const resolved=mode??appIdentity(app).mode;
 return <div data-tos-vnext-frame={app} data-tone={app} className={resolved==="desktop"?styles.desktop:styles.mobile}>{children}</div>;
}
export function TosVNextAppHeader({app,station,onHome}:{
 app:TosVNextAppId;station?:string;onHome:()=>void
}){
 return <header className={styles.header} data-tos-vnext="app-header">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img className={styles.icon} src={appIcon(app)} alt="" width={31} height={31}/>
  <div className={styles.headerText}><strong>{appIdentity(app).title}</strong><small>{station||"PINO · TEAM OPS"}</small></div>
  <button type="button" className={styles.home} onClick={onHome} aria-label="Về Home" title="Về Home">⌂</button>
 </header>;
}
export function TosVNextContent({children}:PropsWithChildren){return <div className={styles.content}>{children}</div>}
export function TosVNextCard({children,...props}:PropsWithChildren<HTMLAttributes<HTMLElement>>){
 const{className,...rest}=props;
 return <article {...rest} className={[styles.card,className].filter(Boolean).join(" ")} data-tos-vnext="card">{children}</article>;
}
export function TosVNextHeading({title,meta}:{title:string;meta?:ReactNode}){
 return <div className={styles.heading} data-tos-vnext="section-heading"><h2>{title}</h2>{meta&&<small>{meta}</small>}</div>;
}
export function TosVNextButton({variant="primary",children,...props}:PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"secondary"|"quiet"}>){
 const kind=variant==="primary"?"":variant==="secondary"?styles.buttonSecondary:styles.buttonQuiet;
 return <button {...props} type={props.type??"button"} className={[styles.button,kind,props.className].filter(Boolean).join(" ")}>{children}</button>;
}
export type TosNavItem={id:string;label:string;icon:ReactNode};
export function TosVNextBottomNav({label,items,active,onChange}:{
 label:string;items:TosNavItem[];active:string;onChange:(id:string)=>void
}){
 if(items.length<2||items.length>5)throw new Error("TOS AppBottomNav requires 2–5 tabs");
 return <nav data-tos-vnext="bottom-nav" className={styles.nav} aria-label={label}>
  {items.map(item=><button key={item.id} type="button" className={styles.tab} aria-current={item.id===active?"page":undefined} onClick={()=>onChange(item.id)}>
   <span className={styles.tabIcon} aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}
 </nav>;
}
/** Accessible dialog: focus stays in the sheet, Escape closes, origin regains focus. */
export function TosVNextSheet({title,onClose,children}:PropsWithChildren<{title:string;onClose:()=>void}>){
 const dialogRef=useRef<HTMLElement>(null);
 const onCloseRef=useRef(onClose);onCloseRef.current=onClose;
 useEffect(()=>{
  const dialog=dialogRef.current;
  if(!dialog)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const focusables=()=>Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
   .filter(el=>el.getClientRects().length>0);
  (focusables()[0]??dialog).focus();
  const onKeyDown=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();onCloseRef.current();return;}
   if(e.key!=="Tab")return;
   const elements=focusables();
   if(!elements.length){e.preventDefault();dialog.focus();return;}
   const first=elements[0],last=elements[elements.length-1];
   if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
    e.preventDefault();last.focus();
   }else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
    e.preventDefault();first.focus();
   }
  };
  document.addEventListener("keydown",onKeyDown);
  return()=>{document.removeEventListener("keydown",onKeyDown);document.body.style.overflow=previousOverflow;previous?.focus();};
 },[]);
 return <div data-tos-vnext="sheet" role="presentation" className={styles.sheetBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget)onCloseRef.current()}}>
  <section ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-label={title} className={styles.sheet}>
   <header className={styles.sheetHeader}><h2>{title}</h2><button type="button" onClick={()=>onCloseRef.current()} aria-label="Đóng">✕</button></header>
   {children}
  </section>
 </div>;
}
export function TosVNextField({label,children}:PropsWithChildren<{label:string}>){return <label className={styles.field}>{label}{children}</label>}
export function TosVNextToast({message}:{message:string}){return message?<div className={styles.toast} role="status" aria-live="polite" data-tos-vnext="toast">{message}</div>:null}
export function TosVNextStatus({children}:PropsWithChildren){return <span className={styles.status}>{children}</span>}
export function TosVNextAppTile({app,disabled,onClick}:{
 app:TosVNextAppId;disabled?:boolean;onClick:()=>void
}){
 const data=appIdentity(app);
 return <button type="button" className={styles.tile} disabled={disabled} aria-label={"Mở "+data.title} onClick={onClick} data-tos-vnext="app-tile">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={appIcon(app)} width={64} height={64} alt=""/><span>{data.title}</span>
 </button>;
}
export const tosVNextStyle={
 grid:styles.grid,body:styles.body,secondary:styles.secondary,caption:styles.caption
} as const;
