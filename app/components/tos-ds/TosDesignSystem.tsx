"use client";
import {type ButtonHTMLAttributes,type PropsWithChildren,type ReactNode} from "react";
import "./tokens.css";
import "./system.css";
import AppPhoneFrame from "./AppPhoneFrame";
import {AppBottomNav,AppCard,AppSectionHeading,AppButton,AppSheet,AppField,AppToast,AppStatusBadge} from "./Primitives";
import header from "./header.module.css";
import styles from "./components.module.css";
import {SIX_TOS_APPS,appIcon,appIdentity,type TosVNextAppId,type TosVNextMode} from "../tos-vnext/identity";
export {SIX_TOS_APPS,appIcon,appIdentity};
export type {TosVNextAppId,TosVNextMode};
export function TosVNextFrame({app,mode,children}:PropsWithChildren<{app:TosVNextAppId;mode?:TosVNextMode}>){
 if((mode??appIdentity(app).mode)==="desktop")return <div data-tos-system data-tos-vnext-frame={app} data-tone={app} className={styles.desktop}>{children}</div>;
 return <AppPhoneFrame viewport={app==="shift"} app={app==="shift-lead"||app==="station"?"shift":app}><div className={styles.mobile} data-tos-vnext-frame={app} data-tone={app}>{children}</div></AppPhoneFrame>;
}
export function TosVNextAppHeader({app,station,onHome}:{app:TosVNextAppId;station?:string;onHome:()=>void}){
 return <header className={header.unifiedHeader} data-tos-app-header={app} data-tos-vnext="app-header"><div className={header.unifiedBrand}>
 <img className={header.unifiedAppIcon} src={appIcon(app)} alt=""/><div><strong>{appIdentity(app).title}</strong><small>{station||"PINO · TEAM OPS"}</small></div></div>
 <div className={header.unifiedHeaderActions}><button className={header.unifiedHome} type="button" aria-label="Về TOS Home" onClick={onHome}><svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg></button></div></header>;
}
export function TosVNextContent({children}:PropsWithChildren){return <div className={styles.content}>{children}</div>}
export const TosVNextCard=AppCard;
export const TosVNextHeading=AppSectionHeading;
export const TosVNextButton=AppButton;
export type TosNavItem={id:string;label:string;icon:ReactNode};
export function TosVNextBottomNav(props:{label:string;items:TosNavItem[];active:string;onChange:(id:string)=>void;tabPanelPrefix?:string}){return <AppBottomNav {...props}/>}
export const TosVNextSheet=AppSheet;
export const TosVNextField=AppField;
export const TosVNextToast=AppToast;
export const TosVNextStatus=AppStatusBadge;
export type TosStatusKind="neutral"|"success"|"warning"|"danger"|"info";
export function TosVNextIconButton({label,children,...props}:PropsWithChildren<Omit<ButtonHTMLAttributes<HTMLButtonElement>,"aria-label">&{label:string}>){return <AppButton {...props} aria-label={label} title={props.title??label}>{children}</AppButton>}
export function TosVNextAppTile({app,disabled,onClick}:{app:TosVNextAppId;disabled?:boolean;onClick:()=>void}){return <button type="button" className={styles.tile} disabled={disabled||app==="shift-lead"} onClick={onClick} aria-label={"Mở "+appIdentity(app).title}><img src={appIcon(app)} alt=""/><span>{appIdentity(app).title}</span></button>}
export const tosVNextStyle={grid:styles.grid,body:styles.body,secondary:styles.secondary,caption:styles.caption} as const;
