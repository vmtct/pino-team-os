"use client";
import type {ReactNode} from "react";
import type {IconDefinition} from "@fortawesome/fontawesome-svg-core";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {AppBottomNav,AppToast} from "../tos-ds";
import css from "./ops.module.css";
export type OpsTab={id:string;label:string;icon:IconDefinition};
/** The integration route owns the single AppPhoneFrame and app header. */
export function OpsFrame(p:{app:"reception";title:string;tabs:OpsTab[];tab:string;onTab:(id:string)=>void;notice:string;children:ReactNode}){
 return <><div className={css.content}>{p.children}</div>{p.tabs.length>0&&<AppBottomNav items={p.tabs.map(t=>({id:t.id,label:t.label,icon:<FontAwesomeIcon icon={t.icon}/>}))} active={p.tab} onChange={p.onTab} label={"Điều hướng "+p.title}/>}<AppToast message={p.notice}/></>;
}
