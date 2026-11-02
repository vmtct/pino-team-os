"use client";
import type { ReactNode, SVGProps } from "react";
export type IconDefinition=string;
export const faArrowLeft="arrowLeft",faArrowUpRightFromSquare="external",faBell="bell",faBookOpen="book",faCalendarDays="calendar",faCamera="camera",faCat="cat",faCheck="check",faChevronDown="down",faChevronRight="right",faCircleCheck="checkCircle",faClipboardList="clipboard",faClock="clock",faDesktop="desktop",faFlag="flag",faGear="gear",faGraduationCap="cap",faInfoCircle="info",faLink="link",faListCheck="list",faLocationDot="pin",faLock="lock",faMagnifyingGlass="search",faMusic="music",faPalette="palette",faPlay="play",faPlus="plus",faRotate="rotate",faStar="star",faTrash="trash",faTriangleExclamation="alert",faUserPlus="userPlus",faUsers="users",faWallet="wallet",faXmark="x";
function shape(icon:string):ReactNode{
 switch(icon){
 case "arrowLeft":return <><path d="M15 18l-6-6 6-6"/><path d="M9 12h12"/></>;
 case "right":return <path d="m9 18 6-6-6-6"/>;
 case "down":return <path d="m6 9 6 6 6-6"/>;
 case "plus":return <path d="M12 5v14M5 12h14"/>;
 case "x":return <path d="M18 6 6 18M6 6l12 12"/>;
 case "check":return <path d="m5 12 4 4L19 6"/>;
 case "checkCircle":return <><circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></>;
 case "clock":return <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>;
 case "calendar":return <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 2v6M16 2v6M3 10h18"/></>;
 case "users":return <><circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5"/></>;
 case "userPlus":return <><circle cx="8" cy="8" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M18 8v8M14 12h8"/></>;
 case "book":return <><path d="M12 6c-3-2-6-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-4-1-7 0-10 2Z"/><path d="M12 6v15"/></>;
 case "clipboard":return <><rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="M9 12h6M9 16h6"/></>;
 case "cap":return <><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 3 9 3 12 0v-5M22 9v7"/></>;
 case "music":return <><path d="M9 18V5l12-2v12"/><ellipse cx="6" cy="19" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/></>;
 case "palette":return <><path d="M12 2a10 10 0 1 0 0 20h1a2.5 2.5 0 0 0 2-4 1.5 1.5 0 0 1 1.5-2H18a4 4 0 0 0 4-4A10 10 0 0 0 12 2Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="15" r="1"/></>;
 case "star":return <path d="m12 2 3.1 6.7 7.4.9-5.4 5.2 1.4 7.2-6.5-3.6-6.5 3.6 1.4-7.2-5.4-5.2 7.4-.9L12 2Z" fill="currentColor" stroke="none"/>;
 case "play":return <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>;
 case "flag":return <><path d="M5 22V3M5 4c5-4 9 4 15 0v12c-6 4-10-4-15 0"/></>;
 case "search":return <><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></>;
 case "camera":return <><path d="M3 8h4l2-3h6l2 3h4v12H3V8Z"/><circle cx="12" cy="14" r="4"/></>;
 case "pin":return <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>;
 case "lock":return <><rect x="4" y="10" width="16" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></>;
 case "info":return <><circle cx="12" cy="12" r="10"/><path d="M12 10v7M12 6h.01"/></>;
 case "alert":return <><path d="m12 2 10 18H2L12 2Z"/><path d="M12 9v5M12 17h.01"/></>;
 case "link":return <><path d="M10 13a5 5 0 0 0 8 .5l3-3a5 5 0 0 0-7-7l-3 3M14 11a5 5 0 0 0-8-.5l-3 3a5 5 0 0 0 7 7l3-3"/></>;
 case "list":return <><path d="m3 6 2 2 3-3M11 6h10m-18 7 2 2 3-3M11 13h10m-18 7 2 2 3-3M11 20h10"/></>;
 case "trash":return <><path d="M4 7h16M10 4h4M6 7l1 14h10l1-14M10 11v7M14 11v7"/></>;
 case "rotate":return <><path d="M21 11a9 9 0 1 0-3 7M21 4v7h-7"/></>;
 case "bell":return <><path d="M18 8a6 6 0 0 0-12 0c0 8-3 9-3 9h18s-3-1-3-9M10 21h4"/></>;
 case "gear":return <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/></>;
 case "desktop":return <><rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8M12 18v4"/></>;
 case "wallet":return <><rect x="2" y="5" width="20" height="16" rx="2"/><path d="M2 8h20M15 13h4"/></>;
 case "external":return <><path d="M13 4h8v8M21 4l-9 9"/><path d="M20 15v5H4V4h5"/></>;
 case "cat":return <><path d="M4 10 3 3l6 3a8 8 0 0 1 6 0l6-3-1 7a9 9 0 1 1-16 0Z"/><path d="M8 12h.01M16 12h.01m-4 3-2 2m2-2 2 2"/></>;
 default:return <circle cx="12" cy="12" r="8"/>;
 }
}
export function FontAwesomeIcon({icon,className,...rest}:{icon:IconDefinition;className?:string}&SVGProps<SVGSVGElement>){
 return <svg {...rest} className={className} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shape(icon)}</svg>;
}
