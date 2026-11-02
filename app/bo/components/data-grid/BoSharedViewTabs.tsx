"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type MouseEvent } from "react";
import { type BoPublicView } from "../../../../lib/bo-public-view-state";
import { BoPublicViewRuntime } from "../../../../lib/bo-public-view-runtime";
import { useBoPublicViewRuntime } from "./useBoPublicViewRuntime";
import styles from "./bo-shared-view-tabs.module.css";

type Props = {
  runtime: BoPublicViewRuntime;
  className?: string;
  onError?: (error: unknown) => void;
};
type MenuState = { id:string; renaming:boolean } | null;

export function BoSharedViewTabs({ runtime, className="", onError }: Props) {
  const { state, status, error } = useBoPublicViewRuntime(runtime);
  const [menu, setMenu] = useState<MenuState>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState("");
  const [draggedId, setDraggedId] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);
  const addInput=useRef<HTMLInputElement>(null);
  const renameInput=useRef<HTMLInputElement>(null);
  const manager=state?.role==="manager";
  const disabled=busy || status==="loading" || status==="mutating";
  const items=state?.views??[];

  useEffect(()=>{ if(adding) addInput.current?.focus(); },[adding]);
  useEffect(()=>{ if(menu?.renaming)renameInput.current?.focus(); },[menu?.id, menu?.renaming]);

  const run = async (promise: Promise<unknown>) => {
    setBusy(true);
    try { await promise; }
    catch(e) { onError?.(e); }
    finally { setBusy(false); }
  };
  const select = (id:string|null) => {
    if(disabled) return;
    try { runtime.select(id);setMenu(null); }
    catch(e) {onError?.(e);}
  };
  const startAdd=()=>{
    setMenu(null);setNewName("");setAdding(true);
  };
  const saveAdd=(e:FormEvent)=>{
    e.preventDefault();
    if(!newName.trim() || disabled)return;
    const name=newName;
    void run(runtime.create(name).then(()=>{setAdding(false);setNewName("");}));
  };
  const menuFor=(event:MouseEvent,id:string)=>{
    if(!manager)return;
    event.preventDefault();
    const selected=items.find(v=>v.id===id);
    setRename(selected?.name??"");
    setMenu({id,renaming:false});
  };
  const saveRename=(event:FormEvent)=>{
    event.preventDefault();
    if(!menu || !rename.trim())return;
    const id=menu.id,name=rename.trim();
    void run(runtime.rename(id,name).then(()=>setMenu(null)));
  };
  const deleteView=(id:string)=>{
    // Deletion is only available in the explicit management menu; caller may
    // intercept via onError for domain-specific dialogs. This component uses a
    // native confirmation to prevent an accidental destructive click.
    if(typeof window!=="undefined" && !window.confirm("Xóa view chung này cho tất cả người dùng?"))return;
    void run(runtime.remove(id).then(()=>setMenu(null)));
  };
  const changePosition=(id:string,offset:number)=>{
    const from=items.findIndex(v=>v.id===id),to=from+offset;
    if(from<0 || to<0 || to>=items.length)return;
    const order=items.map(v=>v.id);
    const [value]=order.splice(from,1);
    order.splice(to,0,value);
    void run(runtime.reorder(order).then(()=>setMenu(null)));
  };
  const onDrop=(e:DragEvent<HTMLButtonElement>,targetId:string)=>{
    e.preventDefault();
    const source=draggedId;
    setDraggedId(null);
    if(!manager || disabled || !source || source===targetId)return;
    const from=items.findIndex(v=>v.id===source),to=items.findIndex(v=>v.id===targetId);
    if(from<0 || to<0)return;
    const order=items.map(v=>v.id);
    const [value]=order.splice(from,1);
    order.splice(to,0,value);
    void run(runtime.reorder(order));
  };

  const active=state?.activeId??null;
  return (
    <div className={`${styles.root} ${className}`.trim()} aria-label="Các chế độ xem dùng chung">
      <div className={styles.strip} role="tablist" aria-label="Saved views">
        <button role="tab" type="button" className={`${styles.tab} ${active===null?styles.selected:""}`}
          aria-selected={active===null} disabled={disabled} onClick={()=>select(null)}>
          Tất cả
        </button>
        {items.map((item:BoPublicView)=>(
          <div key={item.id} className={styles.tabWrap}>
            <button role="tab" type="button" className={`${styles.tab} ${active===item.id?styles.selected:""}`}
              aria-selected={active===item.id} disabled={disabled} draggable={manager&&!disabled}
              onDragStart={(e)=>{setDraggedId(item.id);e.dataTransfer.setData("text/plain",item.id);e.dataTransfer.effectAllowed="move";}}
              onDragOver={(e)=>{if(manager){e.preventDefault();e.dataTransfer.dropEffect="move";}}}
              onDrop={(e)=>onDrop(e,item.id)} onDragEnd={()=>setDraggedId(null)}
              onContextMenu={(e)=>menuFor(e,item.id)}
              onClick={()=>select(item.id)} title={item.name}>
              {item.name}
            </button>
            {manager&&<button type="button" className={styles.more} disabled={disabled}
              aria-label={`Tùy chọn view ${item.name}`} aria-haspopup="menu"
              aria-expanded={menu?.id===item.id}
              onClick={()=>setMenu(menu?.id===item.id?null:{id:item.id,renaming:false})}>
              ⋯
            </button>}
          </div>
        ))}
        {manager && !adding && <button type="button" className={styles.plus}
          disabled={disabled} onClick={startAdd} title="Lưu trạng thái bảng thành view chung"
          aria-label="Thêm view chung">+</button>}
      </div>

      {manager&&adding&&<form className={styles.form} onSubmit={saveAdd}>
        <label className={styles.formLabel} htmlFor="bo-shared-view-new-name">Tên view mới</label>
        <input ref={addInput} id="bo-shared-view-new-name" maxLength={80} required
          value={newName} onChange={(e)=>setNewName(e.target.value)} disabled={disabled}/>
        <button disabled={!newName.trim()||disabled} type="submit">Lưu</button>
        <button type="button" disabled={disabled} onClick={()=>setAdding(false)}>Hủy</button>
      </form>}

      {manager&&menu&&<div role="menu" className={styles.menu} aria-label="Quản lý view chung">
        {menu.renaming ?
          <form className={styles.form} onSubmit={saveRename}>
            <label className={styles.formLabel} htmlFor="bo-shared-view-rename">Đổi tên</label>
            <input ref={renameInput} id="bo-shared-view-rename" maxLength={80} required
              value={rename} onChange={(e)=>setRename(e.target.value)} disabled={disabled}/>
            <button type="submit" disabled={!rename.trim()||disabled}>Lưu</button>
            <button type="button" onClick={()=>setMenu(null)}>Hủy</button>
          </form> :
          <>
            <button role="menuitem" type="button" onClick={()=>{setRename(items.find(v=>v.id===menu.id)?.name??"");setMenu({id:menu.id,renaming:true});}}>
              Đổi tên
            </button>
            <button role="menuitem" type="button" disabled={items[0]?.id===menu.id} onClick={()=>changePosition(menu.id,-1)}>
              Dời sang trái
            </button>
            <button role="menuitem" type="button" disabled={items[items.length-1]?.id===menu.id} onClick={()=>changePosition(menu.id,1)}>
              Dời sang phải
            </button>
            <button role="menuitem" type="button" className={styles.danger} onClick={()=>deleteView(menu.id)}>
              Xóa view chung
            </button>
            <button role="menuitem" type="button" onClick={()=>setMenu(null)}>Đóng</button>
          </>}
      </div>}
      {error&&<p className={styles.error} role="alert">{error.message}</p>}
    </div>
  );
}
