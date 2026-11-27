"use client";
import {useEffect,useRef,useState} from "react";
import {useBoDialog} from "../components/registration/useBoDialog";
import styles from "../workforce/staffs/staff-registration-layout.module.css";
/** PAP-2411: explicit confirmation in both product and isolated native review. */
export function useStaffRegistrationConfirmation(){
 const [message,setMessage]=useState("");
 const pending=useRef<((value:boolean)=>void)|null>(null);
 const panel=useRef<HTMLElement|null>(null);
 const settle=(accepted:boolean)=>{const resolve=pending.current;pending.current=null;setMessage("");resolve?.(accepted);};
 useBoDialog(Boolean(message),()=>settle(false),panel);
 useEffect(()=>()=>{pending.current?.(false);pending.current=null;},[]);
 const ask=(text:string)=>{if(pending.current)return Promise.resolve(false);return new Promise<boolean>(resolve=>{pending.current=resolve;setMessage(text);});};
 const dialog=message?<div className={styles.confirmBackdrop}><section ref={panel} className={styles.confirmPanel} role="alertdialog" aria-modal="true" aria-labelledby="staff-review-confirm-title" aria-describedby="staff-review-confirm-message"><h2 id="staff-review-confirm-title">{"X\u00e1c nh\u1eadn thao t\u00e1c"}</h2><p id="staff-review-confirm-message">{message}</p><div className={styles.confirmActions}><button type="button" onClick={()=>settle(false)}>{"H\u1ee7y"}</button><button type="button" className={styles.confirmPrimary} onClick={()=>settle(true)}>{"X\u00e1c nh\u1eadn"}</button></div></section></div>:null;
 return {ask,dialog};
}
