import type {SVGProps} from "react";
// PAP-1901 · PNR-APP-HUB · low-visual-weight shared line icons, no external font/asset.
export type PinerLineName="home"|"grid"|"reels"|"community"|"heart"|"comment"|"share"|"link"|"hide"|"play"|"pause"|"chevron";
type Props={name:PinerLineName;className?:string}&Omit<SVGProps<SVGSVGElement>,"name"|"children">;
export function PinerLineIcon({name,className,...props}:Props){
 const common={fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 const content=(()=>{
  switch(name){
   case "home":return <><path d="m3.5 10.3 8.5-7 8.5 7"/><path d="M5.5 9.2V20h13V9.2M10 20v-6h4v6"/></>;
   case "grid":return <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>;
   case "reels":return <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 5 4-5 4z"/></>;
   case "community":return <><circle cx="9" cy="8.1" r="3.2"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5z"/><path d="M16.1 5.6a3.1 3.1 0 0 1 0 5.9M17.7 14c2 .6 3 2.2 3 4.5V20h-3"/></>;
   case "heart":return <path d="M20.6 8.1c0-2.2-1.7-4-3.9-4-1.9 0-3.5 1-4.7 2.6C10.8 5.1 9.2 4 7.3 4c-2.2 0-3.9 1.8-3.9 4 0 5 8.6 11.3 8.6 11.3s8.6-6.3 8.6-11.2z"/>;
   case "comment":return <path d="M20.5 11.5A8.5 8.5 0 0 1 12 20a8.8 8.8 0 0 1-4.5-1.3L3 20l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/>;
   case "share":return <><path d="M12 16V3m0 0L7.3 7.7M12 3l4.7 4.7"/><path d="M5 12.5v6c0 1 .8 1.8 1.8 1.8h10.4c1 0 1.8-.8 1.8-1.8v-6"/></>;
   case "link":return <><path d="M10.2 13.8 13.8 10.2"/><path d="M8.9 17H7.5a4.5 4.5 0 0 1 0-9h3.1M15.1 7h1.4a4.5 4.5 0 0 1 0 9h-3.1"/></>;
   case "hide":return <><path d="M3 3 21 21"/><path d="M10 5.2c.7-.1 1.3-.2 2-.2 5 0 8.4 3.6 9.5 7-.4 1.2-1.2 2.4-2.2 3.5M6 6.5C3.9 8 2.7 10 2.5 12c1.1 3.4 4.5 7 9.5 7 1.5 0 2.8-.3 4-.9"/><path d="M9.5 9.5a3.5 3.5 0 0 0 5 5"/></>;
   case "play":return <path d="m9 6 9 6-9 6V6z"/>;
   case "pause":return <><path d="M9 6v12M15 6v12"/></>;
   case "chevron":return <path d="m9 5 7 7-7 7"/>;
  }
 })();
 return <svg {...props} {...common} xmlns="http://www.w3.org/2000/svg" className={className}
   viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-line-icon={name}>{content}</svg>;
}
