import type { PinerAppKey } from "./catalog";
// PAP-1747 · Self-contained app icon artwork; no borrowed TOS icon identities.
export function AppGlyph({ kind }: { kind: PinerAppKey }) {
  const base = { viewBox: "0 0 120 120", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true as const };
  switch (kind) {
    case "little-art": return <svg {...base}>
      <circle cx="33" cy="37" r="17" fill="#FFDA8A"/><circle cx="86" cy="40" r="21" fill="#FFB8BB"/>
      <path d="M32 70c8-25 44-34 63-15 19 21-2 43-23 38-10-2-13-11-23-10-14 1-23-4-17-13Z" fill="#FCF4E9"/>
      <circle cx="52" cy="58" r="6" fill="#FB9C82"/><circle cx="76" cy="57" r="6" fill="#8ABCC0"/>
      <circle cx="85" cy="72" r="6" fill="#D9B7EB"/><circle cx="62" cy="81" r="6" fill="#EFC95F"/>
      <path d="m34 97 32-40" stroke="#63465A" strokeWidth="9" strokeLinecap="round"/>
      <path d="m64 59 7-12 7 4-8 14Z" fill="#E6C7AA"/>
    </svg>;
    case "little-piano": return <svg {...base}>
      <circle cx="87" cy="29" r="18" fill="#F4B8BA"/><circle cx="32" cy="77" r="24" fill="#FFDCB3"/>
      <path d="M32 43c0-6 5-11 11-11h36c6 0 11 5 11 11v48H32V43Z" fill="#FFF9E8" stroke="#8B6471" strokeWidth="4"/>
      {[43,54,65,76].map(x=><path key={x} d={`M${x} 53v35`} stroke="#C9A6AA" strokeWidth="3"/>)}
      {[50,62,74].map(x=><rect key={x} x={x-5} y="51" width="9" height="22" rx="3" fill="#615364"/>)}
      <path d="M19 34c9-6 16-4 22 4M79 15c5-6 11-6 17-2" stroke="#8B6471" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="24" cy="28" r="4" fill="#E89EA5"/><circle cx="100" cy="14" r="4" fill="#9EC6BF"/>
    </svg>;
    case "piano": return <svg {...base}>
      <circle cx="84" cy="28" r="22" fill="#CAC7F2" opacity=".9"/>
      <rect x="24" y="37" width="76" height="60" rx="12" fill="#FDF9FF" stroke="#60537A" strokeWidth="4"/>
      {[39,54,69,84].map(x=><path key={x} d={`M${x} 47v41`} stroke="#C9C5DF" strokeWidth="3"/>)}
      {[46,61,76].map(x=><path key={x} d={`M${x} 47v26`} stroke="#54486F" strokeWidth="11" strokeLinecap="round"/>)}
      <path d="M36 24q15-14 26 0" stroke="#8E78B2" strokeWidth="4" strokeLinecap="round"/>
      <path d="M87 17V5l10 3v13c-2 7-14 8-15 2-1-4 2-6 5-6Z" fill="#8E78B2"/>
    </svg>;
    case "artchitect": return <svg {...base}>
      <circle cx="86" cy="33" r="21" fill="#E5D6A4"/>
      <rect x="26" y="23" width="66" height="73" rx="6" fill="#FFF9E9" stroke="#4E807B" strokeWidth="4" transform="rotate(5 60 60)"/>
      <path d="M35 75 57 50l15 15 12-10 5 30H33Z" fill="#A7D4C5"/>
      <circle cx="69" cy="42" r="7" fill="#EAA98F"/>
      <path d="m19 92 26-30" stroke="#7D5A54" strokeWidth="8" strokeLinecap="round"/>
      <path d="m45 62 8-12 7 6-10 12Z" fill="#E8A39C"/>
      <path d="m85 15 5-8m9 32 8-2" stroke="#85B7A5" strokeWidth="4" strokeLinecap="round"/>
    </svg>;
    case "mytime": return <svg {...base}>
      <circle cx="61" cy="60" r="43" fill="#F6DFC0" opacity=".85"/>
      <path d="M51 28c-3 26 12 43 34 44-19 22-51 10-57-14-4-16 5-27 23-30Z" fill="#AE806A"/>
      <path d="m73 23 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8ZM96 57l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#FFF9F0"/>
      <path d="M40 91c12-7 24-8 38 0" stroke="#A87670" strokeWidth="4" strokeLinecap="round"/>
    </svg>;
  }
}
