"use client";

import { useMemo, useState } from "react";
import "./page.css";

type BookingStatus = "holding" | "confirmed" | "expired" | "cancelled" | "attended" | "no_show";
type Booking = { id:string; name:string; party:string; session:string; status:BookingStatus };
type Session = { id:string; title:string; kind:"Acrylic"|"Piano Spa"; day:string; time:string; booked:number; capacity:number; facilitator:string };

const sessions:Session[]=[
  {id:"s1",title:"Sunday Flowers",kind:"Acrylic",day:"Sat 22 Aug",time:"14:30",booked:4,capacity:8,facilitator:"Trang"},
  {id:"s2",title:"Always With Me",kind:"Piano Spa",day:"Sat 22 Aug",time:"19:00",booked:3,capacity:5,facilitator:"Hương"},
  {id:"s3",title:"Rainy Window",kind:"Acrylic",day:"Sun 23 Aug",time:"14:30",booked:6,capacity:8,facilitator:"Trang"},
  {id:"s4",title:"Kiss The Rain",kind:"Piano Spa",day:"Sun 23 Aug",time:"19:00",booked:4,capacity:5,facilitator:"Bảo"},
];

const acrylicCatalog=[
  {collection:"Slow Living",items:["Sunday Flowers","Morning Coffee","Books by the Window","Little Balcony"]},
  {collection:"Botanical Escape",items:["Wild Garden","Hydrangea Afternoon","Olive Branch","Little Meadow"]},
  {collection:"Postcards",items:["Amalfi Window","Paris Café","Kyoto Alley","Seaside House"]},
  {collection:"After Rain",items:["Rainy Window","Blue Hour","Café at Night","City After Rain"]},
];

const seed:Booking[]=[
  {id:"b1",name:"Minh",party:"1 adult",session:"Rainy Window",status:"attended"},
  {id:"b2",name:"Thảo",party:"2 adults",session:"Rainy Window",status:"confirmed"},
  {id:"b3",name:"Linh",party:"1 adult + child 9",session:"Rainy Window",status:"holding"},
  {id:"b4",name:"Huy",party:"1 adult",session:"Rainy Window",status:"confirmed"},
  {id:"b5",name:"Mai",party:"1 adult",session:"Kiss The Rain",status:"expired"},
  {id:"b6",name:"Khoa",party:"1 adult",session:"Always With Me",status:"holding"},
];

export default function AfterworkOpsPrototype(){
  const [tab,setTab]=useState("weekend");
  const [bookings,setBookings]=useState(seed);
  const totals=useMemo(()=>({booked:sessions.reduce((n,s)=>n+s.booked,0),capacity:sessions.reduce((n,s)=>n+s.capacity,0)}),[]);
  const liveHolds=bookings.filter(b=>b.status==="holding").length;
  const confirmed=bookings.filter(b=>["confirmed","attended"].includes(b.status)).length;
  const toggleCheckin=(id:string)=>setBookings((rows)=>rows.map((b)=>b.id===id&&["confirmed","attended"].includes(b.status)?{...b,status:b.status==="attended"?"confirmed":"attended"}:b));
  return <main className="awops">
    <aside className="awops-side">
      <div><strong>PINO</strong><span>TEAM OS</span></div>
      <p>AFTERWORK · PROTOTYPE</p>
      <nav>{[["weekend","This Weekend"],["sessions","Sessions"],["bookings","Bookings"],["checkin","Check-in"],["piano","Piano Journeys"],["catalog","Catalog"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={tab===id?"active":""}>{label}</button>)}</nav>
      <small>Mock UI only · no Core/payment writes</small>
    </aside>
    <section className="awops-main">
      <header><div><p className="kicker">Weekend operations</p><h1>Afterwork</h1></div><div className="staff"><span>Prototype mode</span><b>Founder</b></div></header>
      {tab==="weekend"&&<Weekend totals={totals} holds={liveHolds} confirmed={confirmed}/>} 
      {tab==="sessions"&&<Sessions/>}
      {tab==="bookings"&&<Bookings bookings={bookings}/>} 
      {tab==="checkin"&&<Checkin bookings={bookings.filter(b=>b.session==="Rainy Window"&&["confirmed","attended"].includes(b.status))} toggle={toggleCheckin}/>} 
      {tab==="piano"&&<Piano/>}
      {tab==="catalog"&&<Catalog/>}
    </section>
  </main>
}

function Weekend({totals,holds,confirmed}:{totals:{booked:number;capacity:number};holds:number;confirmed:number}){return <>
  <div className="stats"><Stat n="4" label="Sessions"/><Stat n={`${totals.booked}/${totals.capacity}`} label="Live seats"/><Stat n={String(holds)} label="Active holds"/><Stat n={String(confirmed)} label="Confirmed / attended"/></div>
  <section className="panel"><div className="panel-head"><div><p className="kicker">22–23 August</p><h2>This weekend</h2></div><button>+ New session</button></div><div className="session-list">{sessions.map(s=><article key={s.id}><div className={`kind ${s.kind==="Acrylic"?"paint":"piano"}`}>{s.kind}</div><div><small>{s.day}</small><h3>{s.title}</h3><p>{s.time} · {s.facilitator}</p></div><div className="seat"><b>{s.booked}/{s.capacity}</b><span>{s.capacity-s.booked===1?"1 seat left":`${s.capacity-s.booked} seats left`}</span></div><button className="ghost">Open</button></article>)}</div></section>
  <div className="two"><section className="panel"><div className="panel-head"><div><p className="kicker">Attention</p><h2>Needs a look</h2></div></div><ul className="attention"><li><b>Linh · Rainy Window</b><span>HOLDING · deposit not verified</span></li><li><b>Khoa · Always With Me</b><span>HOLDING · expiry policy TBD</span></li><li><b>Mai · Kiss The Rain</b><span>EXPIRED · seat released</span></li></ul></section><section className="panel calm"><p className="kicker">Operating principle</p><h2>Held is not confirmed.</h2><p>Staff should see temporary holds separately from confirmed participants. Check-in only shows eligible confirmed bookings.</p></section></div>
</>}
function Stat({n,label}:{n:string;label:string}){return <div className="stat"><strong>{n}</strong><span>{label}</span></div>}
function Sessions(){return <section className="panel"><div className="panel-head"><div><p className="kicker">Operational catalog → session</p><h2>Sessions</h2></div><button>+ New session</button></div><div className="form-mock"><label>Experience<select defaultValue="Acrylic"><option>Acrylic</option><option>Piano Spa</option></select></label><label>Offering<select defaultValue="Rainy Window"><option>Rainy Window</option><option>Sunday Flowers</option><option>Always With Me</option><option>Kiss The Rain</option></select></label><label>Date<input value="2026-08-23" readOnly/></label><label>Time<input value="14:30 → 17:00" readOnly/></label><label>Capacity<input value="8" readOnly/></label><label>Deposit<input value="Required · amount policy TBD" readOnly/></label><label>Facilitator<select defaultValue="Trang"><option>Trang</option><option>Hương</option><option>Bảo</option></select></label><button>Publish session</button></div><p className="mock-note">Prototype only. Runtime publish and commercial terms will be protected Core commands.</p></section>}
function Bookings({bookings}:{bookings:Booking[]}){return <section className="panel"><div className="panel-head"><div><p className="kicker">One canonical lifecycle</p><h2>Bookings</h2></div><button>+ Manual booking</button></div><div className="table"><div className="tr th"><span>Name</span><span>Party</span><span>Session</span><span>Status</span></div>{bookings.map(b=><div className="tr" key={b.id}><b>{b.name}</b><span>{b.party}</span><span>{b.session}</span><span className={statusClass(b.status)}>{statusLabel(b.status)}</span></div>)}</div><p className="mock-note">HOLDING reserves capacity temporarily. CONFIRMED requires verified deposit. EXPIRED releases capacity. No payment provider is connected in this prototype.</p></section>}
function Checkin({bookings,toggle}:{bookings:Booking[];toggle:(id:string)=>void}){return <section className="panel check"><div className="panel-head"><div><p className="kicker">Sun · 14:30</p><h2>Rainy Window</h2><p>Confirmed participants only</p></div><span className="big-seat">{bookings.length} eligible</span></div>{bookings.map(b=><button key={b.id} onClick={()=>toggle(b.id)} className={b.status==="attended"?"checked":""}><span className="tick">{b.status==="attended"?"✓":""}</span><b>{b.name}</b><small>{b.party} · {statusLabel(b.status)}</small></button>)}<p className="mock-note">The HOLDING booking for Linh is intentionally absent until deposit confirmation.</p></section>}
function Piano(){return <><div className="stats"><Stat n="7" label="Active journeys"/><Stat n="2" label="Near performance"/><Stat n="3" label="Vinyl pending"/><Stat n="1" label="NFC release ready"/></div><section className="panel"><div className="panel-head"><div><p className="kicker">Piano Spa</p><h2>Active journeys</h2></div></div><div className="journeys"><Journey name="Linh" song="Always With Me" stage="Expression" pct="72%"/><Journey name="Khoa" song="Kiss The Rain" stage="Two Hands" pct="44%"/><Journey name="Mai" song="One Summer’s Day" stage="Performance" pct="91%"/></div></section></>}
function Journey({name,song,stage,pct}:{name:string;song:string;stage:string;pct:string}){return <article><div><small>{name}</small><h3>{song}</h3><p>{stage}</p></div><div className="progress"><i style={{width:pct}}/><span>{pct}</span></div><button className="ghost">Open</button></article>}
function Catalog(){return <><div className="stats"><Stat n="4" label="Acrylic collections"/><Stat n="16" label="Acrylic paintings"/><Stat n="2" label="Active this weekend"/><Stat n="3" label="Piano collections"/></div><section className="panel"><div className="panel-head"><div><p className="kicker">Curated offerings</p><h2>Acrylic catalog</h2></div><button>+ Offering</button></div><div className="catalog">{acrylicCatalog.map(group=><div key={group.collection}><b>{group.collection}</b><span>{group.items.length} paintings</span><p>{group.items.join(" · ")}</p></div>)}</div><p className="mock-note">Catalog ≠ session. Staff curate offerings into dated operational sessions.</p></section><section className="panel"><div className="panel-head"><div><p className="kicker">Piano Spa</p><h2>Song collections</h2></div></div><div className="catalog"><div><b>Ghibli Collection</b><span>Song discovery</span><p>Always With Me · One Summer’s Day · Merry-Go-Round of Life</p></div><div><b>Rainy Piano</b><span>Song discovery</span><p>Kiss The Rain · River Flows in You · Comptine</p></div><div><b>Cinema Piano</b><span>Song discovery</span><p>Interstellar · La La Land · Nuvole Bianche</p></div></div></section></>}

function statusLabel(status:BookingStatus){return ({holding:"HOLDING",confirmed:"CONFIRMED",expired:"EXPIRED",cancelled:"CANCELLED",attended:"ATTENDED",no_show:"NO SHOW"})[status]}
function statusClass(status:BookingStatus){return ["confirmed","attended"].includes(status)?"ok":"pending"}
