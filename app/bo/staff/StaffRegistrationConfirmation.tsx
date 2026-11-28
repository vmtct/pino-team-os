"use client";
import {useEffect,useRef,useState} from "react";
import {BoDrawer} from "../components/data-grid";
import styles from "../bo.module.css";
/** PAP-2411: explicit confirmation in both product and isolated native review. */
export function useStaffRegistrationConfirmation(){
 const [message,setMessage]=useState("");
 const pending=useRef<((value:boolean)=>void)|null>(null);
 const settle=(accepted:boolean)=>{const resolve=pending.current;pending.current=null;setMessage("");resolve?.(accepted);};
 useEffect(()=>()=>{pending.current?.(false);pending.current=null;},[]);
 const ask=(text:string)=>{if(pending.current)return Promise.resolve(false);return new Promise<boolean>(resolve=>{pending.current=resolve;setMessage(text);});};
 const dialog=message?<BoDrawer title={"X\u00e1c nh\u1eadn thao t\u00e1c"} size="sm" onClose={()=>settle(false)} footer={<><button type="button" className={styles.secondaryButton} onClick={()=>settle(false)}>{"H\u1ee7y"}</button><button type="button" className={styles.primaryButton} onClick={()=>settle(true)}>{"X\u00e1c nh\u1eadn"}</button></>}><p>{message}</p></BoDrawer>:null;
 return {ask,dialog};
}
