import type { PinerAppKey } from "./catalog";
export function AppGlyph({kind}:{kind:PinerAppKey}){
 const base={viewBox:"0 0 120 120",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":true as const};
 return kind==="hoi-hoa"?<svg {...base}>
  <circle cx="84" cy="33" r="21" fill="#E5D6A4"/>
  <rect x="26" y="23" width="66" height="73" rx="6" fill="#FFF9E9" stroke="#995977" strokeWidth="4" transform="rotate(5 60 60)"/>
  <path d="M35 75 57 50l15 15 12-10 5 30H33Z" fill="#E6A5B9"/>
  <circle cx="69" cy="42" r="7" fill="#EFC178"/>
  <path d="m19 92 26-30" stroke="#7D5A54" strokeWidth="8" strokeLinecap="round"/>
  <path d="m45 62 8-12 7 6-10 12Z" fill="#E8A39C"/>
  <path d="m85 15 5-8m9 32 8-2" stroke="#B48CB9" strokeWidth="4" strokeLinecap="round"/>
 </svg>:<svg {...base}>
  <circle cx="84" cy="28" r="22" fill="#CAC7F2" opacity=".9"/>
  <rect x="24" y="37" width="76" height="60" rx="12" fill="#FDF9FF" stroke="#60537A" strokeWidth="4"/>
  {[39,54,69,84].map(x=><path key={x} d={`M${x} 47v41`} stroke="#C9C5DF" strokeWidth="3"/>)}
  {[46,61,76].map(x=><path key={x} d={`M${x} 47v26`} stroke="#54486F" strokeWidth="11" strokeLinecap="round"/>)}
  <path d="M36 24q15-14 26 0" stroke="#8E78B2" strokeWidth="4" strokeLinecap="round"/>
  <path d="M87 17V5l10 3v13c-2 7-14 8-15 2-1-4 2-6 5-6Z" fill="#8E78B2"/>
 </svg>;
}
