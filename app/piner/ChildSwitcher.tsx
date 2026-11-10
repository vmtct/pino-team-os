"use client";
// PAP-1823 / PNR-APP-HUB — design the OPEN child selection list, not its header wrapper.
import {useEffect,useRef,useState} from "react";
import {getProfile,MANAGED_CHILDREN} from "./profiles";
import css from "./launcher.module.css";

type ChildId="an"|"binh";
export function ChildSwitcher({currentChild,onSelect}:{currentChild:ChildId;onSelect:(id:ChildId)=>void}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const options=useRef<Array<HTMLButtonElement|null>>([]);
 const child=getProfile(currentChild);
 const close=(returnFocus:boolean)=>{
  setOpen(false);
  if(returnFocus)requestAnimationFrame(()=>trigger.current?.focus());
 };
 const choose=(id:ChildId)=>{
  onSelect(id);
  close(true);
 };
 useEffect(()=>{
  if(!open)return;
  const selected=MANAGED_CHILDREN.findIndex(p=>p.id===currentChild);
  requestAnimationFrame(()=>options.current[selected<0?0:selected]?.focus());
  const outside=(event:PointerEvent)=>{
   if(root.current&&!root.current.contains(event.target as Node))setOpen(false);
  };
  document.addEventListener("pointerdown",outside);
  return()=>document.removeEventListener("pointerdown",outside);
 },[open,currentChild]);
 const handleKey=(event:React.KeyboardEvent<HTMLDivElement>)=>{
  if(event.key==="Escape"&&open){event.preventDefault();close(true);return;}
  if(event.key==="Tab"&&open){setOpen(false);return;}
  if(!open)return;
  const index=options.current.findIndex(x=>x===document.activeElement);
  let next=index;
  if(event.key==="ArrowDown")next=(index+1)%MANAGED_CHILDREN.length;
  else if(event.key==="ArrowUp")next=index<=0?MANAGED_CHILDREN.length-1:index-1;
  else if(event.key==="Home")next=0;
  else if(event.key==="End")next=MANAGED_CHILDREN.length-1;
  else return;
  event.preventDefault();
  options.current[next]?.focus();
 };
 return <div ref={root} className={css.unifiedSwitcher} data-child-switcher="house" onKeyDown={handleKey}>
   <span className={css.unifiedProfileCircle} aria-hidden="true">{child.avatar}</span>
   <button ref={trigger} type="button" className={css.childTrigger} data-child-trigger="house"
    aria-label="Chọn con đang xem" aria-haspopup="listbox" aria-controls={open?"piner-child-options":undefined}
    aria-expanded={open} onClick={()=>setOpen(value=>!value)}
    onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();setOpen(true);}}}>
    <span>{child.display}</span><span className={css.childTriggerChevron} aria-hidden="true">⌄</span>
   </button>
   {open&&<div id="piner-child-options" role="listbox" aria-label="Chọn hồ sơ học viên" className={css.childOptions} data-child-options-menu="open">
    <div className={css.childOptionsTitle} aria-hidden="true">Chọn hồ sơ</div>
    {MANAGED_CHILDREN.map((item,index)=><button
      key={item.id} type="button" role="option" id={"child-option-"+item.id}
      ref={el=>{options.current[index]=el}}
      className={css.childOption} aria-selected={item.id===currentChild} data-child-option={item.id}
      onClick={()=>choose(item.id as ChildId)}>
      <span className={css.childOptionAvatar} aria-hidden="true">{item.avatar}</span>
      <span className={css.childOptionLabel}><strong>{item.display}</strong><small>{item.program}</small></span>
      {item.id===currentChild&&<span className={css.childOptionCheck} aria-hidden="true">✓</span>}
    </button>)}
   </div>}
 </div>;
}
