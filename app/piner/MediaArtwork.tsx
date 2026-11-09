// PAP-1764 · Synthetic art and video cover illustrations, NOT identifiable student imagery.
import type { MediaPost } from "./media";
export function MediaArtwork({post}:{post:MediaPost}){
 const isPiano=post.app==="piano";
 const visual=post.visual;
 return <svg viewBox="0 0 400 350" preserveAspectRatio="xMidYMid slice" role="img" aria-label={"Tranh minh họa cho "+post.title} className="piner-artwork">
  <defs>
   <linearGradient id={post.id+"bg"} x1="0" y1="0" x2="1" y2="1"><stop stopColor={isPiano?"#b6addb":"#f3caad"}/><stop offset="1" stopColor={isPiano?"#51436d":"#dca1ae"}/></linearGradient>
   <radialGradient id={post.id+"sun"}><stop stopColor="#fff7ce"/><stop offset="1" stopColor="#f2d5a3"/></radialGradient>
  </defs>
  <rect width="400" height="350" fill={"url(#"+post.id+"bg)"}/>
  {!isPiano && (visual==="landscape" ? <>
   <circle cx="290" cy="93" r="62" fill={"url(#"+post.id+"sun)"} opacity=".92"/>
   <path d="M0 196C75 139 129 205 199 158S322 117 400 166V350H0Z" fill="#b2b8aa"/>
   <path d="M0 235C94 194 148 247 218 206S345 203 400 190V350H0Z" fill="#678c8b"/>
   <path d="M0 290C103 260 170 292 255 250S348 260 400 244V350H0Z" fill="#45687f"/>
  </>:visual==="ceramic"?<>
   <rect y="260" width="400" height="90" fill="#e3c5ba"/>
   <path d="M172 72h60l-8 44c31 26 42 48 42 87 0 52-39 91-69 91s-67-41-67-91c0-39 13-64 50-87Z" fill="#f9ead5" stroke="#638b9a" strokeWidth="8"/>
   <path d="M155 168c33-34 68-34 94 0M155 228c31-28 63-28 90 0" stroke="#688e9d" strokeWidth="9" fill="none"/>
   <path d="M181 157c14 20 12 54 8 89" stroke="#b5a7d4" strokeWidth="7" fill="none"/>
   <circle cx="217" cy="199" r="11" fill="#e5a89f"/>
  </>:visual==="abstract"?<>
   <path d="M40 350C89 190 118 125 278-12" stroke="#ffe7b1" strokeWidth="73" opacity=".9"/>
   <path d="M-17 93C141 40 250 213 435 192" stroke="#d76f89" strokeWidth="73" opacity=".87" fill="none"/>
   <path d="M-18 253C142 176 260 382 428 285" stroke="#8aab9d" strokeWidth="63" opacity=".91" fill="none"/>
   <circle cx="270" cy="78" r="47" fill="#fff3d2" opacity=".84"/>
  </>:<>
   <path d="M0 280C98 219 159 259 242 232S358 209 400 242V350H0Z" fill="#e3aaad"/>
   <path d="M188 342C189 255 188 188 181 127M231 321C226 268 230 203 251 168M120 329c-5-62 2-91 29-133" stroke="#527969" strokeWidth="9" strokeLinecap="round"/>
   {[[181,117],[146,201],[246,154],[242,234],[118,236],[188,191]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="35" fill={i%2?"#e79cab":"#faf0d6"} opacity=".96"/><circle cx={x} cy={y} r="10" fill="#d39b60"/></g>)}
  </>)}
  {isPiano && <>
   <circle cx="305" cy="76" r="103" fill="#e6d6d3" opacity=".52"/>
   <path d="M0 206Q147 113 400 185V350H0Z" fill="#695772"/>
   <g transform={visual==="concert"?"translate(12 52) rotate(-9 200 200)":"translate(15 77) rotate(-12 200 200)"}>
    <rect x="20" y="82" width="385" height="192" rx="11" fill="#302d44" stroke="#e8dfe5" strokeWidth="9"/>
    {Array.from({length:13},(_,i)=><rect key={i} x={35+i*28} y="95" width="27" height="168" rx="2" fill="#f8f5ef" stroke="#c0b8bb" strokeWidth="1.5"/>)}
    {[0,1,3,4,5,7,8,10,11].map(i=><rect key={i} x={55+i*28} y="95" width="17" height="95" rx="2" fill="#2a263d"/>)}
   </g>
   {visual==="music"&&<path d="M64 70v-37l25-7v35m0-35v35" stroke="#eee1ef" strokeWidth="5" fill="none"/>}
   {visual==="studio"&&<circle cx="80" cy="71" r="27" fill="#ffe9bf" opacity=".74"/>}
  </>}
  <rect x="10" y="10" width="115" height="25" rx="12" fill="#ffffffa8"/><text x="23" y="27" fontSize="12" fontFamily="Arial" fontWeight="700" fill="#514052">MINH HỌA</text>
 </svg>;
}
