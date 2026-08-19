"use client";

import { useMemo, useState } from "react";

type View = "overview" | "sessions" | "paintings" | "songs" | "bookings" | "checkin" | "journeys";
type LibraryType = "Painting" | "Piano Song";
type BookingStatus = "holding" | "confirmed" | "expired" | "cancelled" | "attended" | "no_show";
type SessionRow = {
  id: string;
  sourceType: LibraryType;
  sourceTitle: string;
  collection: string;
  day: string;
  time: string;
  booked: number;
  capacity: number;
  facilitator: string;
  deposit: string;
  publicSlug?: string;
  status: "Published" | "Draft" | "Cancelled";
};
type Booking = {
  id: string;
  name: string;
  party: string;
  sessionId: string;
  sessionLabel: string;
  status: BookingStatus;
  holdUntil?: string;
  paymentIssue?: string;
};

const paintings = [
  { collection: "Slow Living", title: "Sunday Flowers", visual: "linear-gradient(145deg,#8a9b72,#d7c6a2 52%,#e6a59a)", mood: "warm · soft · slow" },
  { collection: "Slow Living", title: "Morning Coffee", visual: "linear-gradient(145deg,#5d4439,#b99072 48%,#efe0c5)", mood: "cozy · earthy · quiet" },
  { collection: "Slow Living", title: "Books by the Window", visual: "linear-gradient(145deg,#8c6f55,#d8c5a5 50%,#8092a2)", mood: "calm · literary · warm" },
  { collection: "Slow Living", title: "Little Balcony", visual: "linear-gradient(145deg,#718869,#d8d0ad 50%,#c6866f)", mood: "airy · green · homelike" },
  { collection: "Botanical Escape", title: "Wild Garden", visual: "linear-gradient(145deg,#49634a,#9cad76 48%,#e7c5a2)", mood: "lush · loose · alive" },
  { collection: "Botanical Escape", title: "Hydrangea Afternoon", visual: "linear-gradient(145deg,#63799a,#b5a9c8 48%,#d8e1cf)", mood: "soft · floral · dreamy" },
  { collection: "Botanical Escape", title: "Olive Branch", visual: "linear-gradient(145deg,#52644f,#a7ae86 55%,#e2d8bd)", mood: "minimal · meditative · sage" },
  { collection: "Botanical Escape", title: "Little Meadow", visual: "linear-gradient(145deg,#8cb58c,#d7d79b 50%,#c2d7e2)", mood: "bright · breezy · open" },
  { collection: "Postcards", title: "Amalfi Window", visual: "linear-gradient(145deg,#3e88a0,#8ac5cc 48%,#e7c27d)", mood: "sunny · mediterranean · blue" },
  { collection: "Postcards", title: "Paris Café", visual: "linear-gradient(145deg,#6f4d48,#c49273 50%,#ddc8ad)", mood: "romantic · urban · warm" },
  { collection: "Postcards", title: "Kyoto Alley", visual: "linear-gradient(145deg,#5b453b,#b86752 48%,#d3b98f)", mood: "quiet · lantern · nostalgic" },
  { collection: "Postcards", title: "Seaside House", visual: "linear-gradient(145deg,#5d95a6,#b9d7d3 50%,#efe0b4)", mood: "coastal · airy · restful" },
  { collection: "After Rain", title: "Rainy Window", visual: "linear-gradient(145deg,#445466,#758696 48%,#c89a72)", mood: "quiet · rainy · cinematic" },
  { collection: "After Rain", title: "Blue Hour", visual: "linear-gradient(145deg,#34475e,#667d9b 55%,#d8a876)", mood: "blue · still · reflective" },
  { collection: "After Rain", title: "Café at Night", visual: "linear-gradient(145deg,#2f3540,#6c584c 48%,#d29a5e)", mood: "amber · intimate · rainy" },
  { collection: "After Rain", title: "City After Rain", visual: "linear-gradient(145deg,#283742,#596b72 48%,#a5755c)", mood: "moody · glossy · urban" },
];

const pianoSongs = [
  { collection: "Ghibli Collection", title: "Always With Me", mood: "gentle · nostalgic" },
  { collection: "Ghibli Collection", title: "One Summer’s Day", mood: "open · tender" },
  { collection: "Ghibli Collection", title: "Merry-Go-Round", mood: "waltz · cinematic" },
  { collection: "Rainy Piano", title: "Kiss The Rain", mood: "calm · introspective" },
  { collection: "Rainy Piano", title: "River Flows in You", mood: "flowing · intimate" },
  { collection: "Rainy Piano", title: "Comptine", mood: "minimal · bittersweet" },
  { collection: "Cinema Piano", title: "Interstellar", mood: "spacious · meditative" },
  { collection: "Cinema Piano", title: "La La Land", mood: "warm · wistful" },
  { collection: "Cinema Piano", title: "Nuvole Bianche", mood: "lyrical · expansive" },
];

const initialSessions: SessionRow[] = [
  { id: "AW-0822-A", sourceType: "Painting", sourceTitle: "Sunday Flowers", collection: "Slow Living", day: "Sat 22 Aug", time: "14:30–17:00", booked: 4, capacity: 8, facilitator: "Trang", deposit: "100k / seat", publicSlug: "sunday-flowers-22-aug", status: "Published" },
  { id: "AW-0822-P", sourceType: "Piano Song", sourceTitle: "Always With Me", collection: "Ghibli Collection", day: "Sat 22 Aug", time: "19:00–20:30", booked: 3, capacity: 5, facilitator: "Hương", deposit: "100k / seat", publicSlug: "always-with-me-22-aug", status: "Published" },
  { id: "AW-0823-A", sourceType: "Painting", sourceTitle: "Rainy Window", collection: "After Rain", day: "Sun 23 Aug", time: "14:30–17:00", booked: 6, capacity: 8, facilitator: "Trang", deposit: "100k / seat", publicSlug: "rainy-window-23-aug", status: "Published" },
  { id: "AW-0823-P", sourceType: "Piano Song", sourceTitle: "Kiss The Rain", collection: "Rainy Piano", day: "Sun 23 Aug", time: "19:00–20:30", booked: 4, capacity: 5, facilitator: "Bảo", deposit: "100k / seat", publicSlug: "kiss-the-rain-23-aug", status: "Published" },
];

const seedBookings: Booking[] = [
  { id: "b1", name: "Minh", party: "1 adult", sessionId: "AW-0823-A", sessionLabel: "Rainy Window · Sun 23 Aug 14:30", status: "attended" },
  { id: "b2", name: "Thảo", party: "2 adults", sessionId: "AW-0823-A", sessionLabel: "Rainy Window · Sun 23 Aug 14:30", status: "confirmed" },
  { id: "b3", name: "Linh", party: "1 adult + child 9", sessionId: "AW-0823-A", sessionLabel: "Rainy Window · Sun 23 Aug 14:30", status: "holding", holdUntil: "10:50" },
  { id: "b4", name: "Huy", party: "1 adult", sessionId: "AW-0823-A", sessionLabel: "Rainy Window · Sun 23 Aug 14:30", status: "confirmed" },
  { id: "b5", name: "Mai", party: "1 adult", sessionId: "AW-0823-P", sessionLabel: "Kiss The Rain · Sun 23 Aug 19:00", status: "expired", paymentIssue: "Late payment received · reconciliation" },
  { id: "b6", name: "Khoa", party: "1 adult", sessionId: "AW-0822-P", sessionLabel: "Always With Me · Sat 22 Aug 19:00", status: "holding", holdUntil: "10:42" },
];

const viewLabels: Array<[View, string]> = [
  ["overview", "Overview"],
  ["sessions", "Sessions"],
  ["paintings", "Paintings"],
  ["songs", "Piano Songs"],
  ["bookings", "Bookings"],
  ["checkin", "Check-in"],
  ["journeys", "Piano Journeys"],
];

export default function AfterworkFounderPrototype() {
  const [view, setView] = useState<View>("overview");
  const [sessionRows, setSessionRows] = useState(initialSessions);
  const [bookings, setBookings] = useState(seedBookings);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [sourceType, setSourceType] = useState<LibraryType>("Painting");
  const [sourceTitle, setSourceTitle] = useState("Sunday Flowers");
  const [sessionDate, setSessionDate] = useState("2026-08-30");
  const [sessionTime, setSessionTime] = useState("14:30");
  const [capacity, setCapacity] = useState("8");
  const [facilitator, setFacilitator] = useState("Trang");

  const totals = useMemo(() => ({
    booked: sessionRows.reduce((sum, row) => sum + row.booked, 0),
    capacity: sessionRows.reduce((sum, row) => sum + row.capacity, 0),
  }), [sessionRows]);
  const liveHolds = bookings.filter((booking) => booking.status === "holding").length;
  const confirmed = bookings.filter((booking) => ["confirmed", "attended"].includes(booking.status)).length;

  const sourceOptions = sourceType === "Painting" ? paintings.map((item) => item.title) : pianoSongs.map((item) => item.title);
  const selectedSource = sourceType === "Painting" ? paintings.find((item) => item.title === sourceTitle) : pianoSongs.find((item) => item.title === sourceTitle);
  const landingSlugPreview = makeLandingSlug(sourceTitle, sessionDate);

  function openSessionBuilder(type: LibraryType = "Painting", title?: string) {
    const firstTitle = type === "Painting" ? paintings[0].title : pianoSongs[0].title;
    setSourceType(type);
    setSourceTitle(title ?? firstTitle);
    setSessionTime(type === "Painting" ? "14:30" : "19:00");
    setCapacity(type === "Painting" ? "8" : "5");
    setFacilitator(type === "Painting" ? "Trang" : "Hương");
    setBuilderOpen(true);
  }

  function changeSourceType(type: LibraryType) {
    setSourceType(type);
    setSourceTitle(type === "Painting" ? paintings[0].title : pianoSongs[0].title);
    setSessionTime(type === "Painting" ? "14:30" : "19:00");
    setCapacity(type === "Painting" ? "8" : "5");
  }

  function createPrototypeSession() {
    const source = sourceType === "Painting" ? paintings.find((item) => item.title === sourceTitle) : pianoSongs.find((item) => item.title === sourceTitle);
    if (!source) return;
    const dateLabel = new Date(`${sessionDate}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
    const duration = sourceType === "Painting" ? "17:00" : "20:30";
    const row: SessionRow = {
      id: `AW-DEMO-${sessionRows.length + 1}`,
      sourceType,
      sourceTitle,
      collection: source.collection,
      day: dateLabel,
      time: `${sessionTime}–${duration}`,
      booked: 0,
      capacity: Number(capacity) || (sourceType === "Painting" ? 8 : 5),
      facilitator,
      deposit: "100k / seat",
      publicSlug: landingSlugPreview,
      status: "Draft",
    };
    setSessionRows((rows) => [row, ...rows]);
    setBuilderOpen(false);
    setView("sessions");
  }

  function toggleCheckin(id: string) {
    setBookings((rows) => rows.map((booking) => booking.id === id && ["confirmed", "attended"].includes(booking.status) ? { ...booking, status: booking.status === "attended" ? "confirmed" : "attended" } : booking));
  }

  return <div className="founder-page afterwork-founder-page">
    <header className="founder-header afterwork-header">
      <div>
        <div className="eyebrow">Afterwork prototype</div>
        <h1>Afterwork Operations</h1>
        <p>Library items are reusable. Sessions are dated occurrences. Bookings attach to one session.</p>
      </div>
      <div className="afterwork-header-actions">
        <span className="prototype-badge">Mock data · no writes</span>
        <button className="button" type="button" onClick={() => openSessionBuilder()}>+ New session</button>
      </div>
    </header>

    <section className="afterwork-model" aria-label="Afterwork operating model">
      <div className="model-step"><span>Library</span><strong>Painting / Piano Song</strong><small>Reusable creative content. No date, capacity or booking state.</small></div>
      <b>→</b>
      <div className="model-step active"><span>Session</span><strong>One occurrence</strong><small>Date + time + capacity + facilitator + commercial terms.</small></div>
      <b>→</b>
      <div className="model-step"><span>Booking</span><strong>Seats in one session</strong><small>HOLDING → CONFIRMED → attendance / cancellation lifecycle.</small></div>
    </section>

    <div className="afterwork-tabs" role="tablist" aria-label="Afterwork views">
      {viewLabels.map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}
    </div>

    {view === "overview" && <Overview sessions={sessionRows} totals={totals} holds={liveHolds} confirmed={confirmed} onNewSession={() => openSessionBuilder()} />}
    {view === "sessions" && <Sessions sessions={sessionRows} onNewSession={() => openSessionBuilder()} />}
    {view === "paintings" && <Paintings onCreate={(title) => openSessionBuilder("Painting", title)} />}
    {view === "songs" && <PianoSongs onCreate={(title) => openSessionBuilder("Piano Song", title)} />}
    {view === "bookings" && <Bookings bookings={bookings} />}
    {view === "checkin" && <Checkin bookings={bookings.filter((booking) => booking.sessionId === "AW-0823-A" && ["confirmed", "attended"].includes(booking.status))} toggle={toggleCheckin} />}
    {view === "journeys" && <PianoJourneys />}

    {builderOpen && <div className="builder-backdrop" role="presentation" onMouseDown={() => setBuilderOpen(false)}>
      <section className="session-builder panel" role="dialog" aria-modal="true" aria-label="Create Afterwork session" onMouseDown={(event) => event.stopPropagation()}>
        <div className="builder-head"><div><span className="muted">Create occurrence</span><h2>New session</h2></div><button className="builder-close" type="button" onClick={() => setBuilderOpen(false)}>×</button></div>
        <div className="builder-source"><span>1 · Choose reusable library item</span><strong>{sourceType}: {sourceTitle}</strong><small>{selectedSource?.collection ?? "Library"} · selecting this does not modify the library item.</small></div>
        <div className="form-grid afterwork-form-grid">
          <label>Library type<select value={sourceType} onChange={(event) => changeSourceType(event.target.value as LibraryType)}><option>Painting</option><option>Piano Song</option></select></label>
          <label>Library item<select value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)}>{sourceOptions.map((title) => <option key={title}>{title}</option>)}</select></label>
          <label>Date<input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /></label>
          <label>Start time<input type="time" value={sessionTime} onChange={(event) => setSessionTime(event.target.value)} /></label>
          <label>Capacity<input inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
          <label>Facilitator<select value={facilitator} onChange={(event) => setFacilitator(event.target.value)}><option>Trang</option><option>Hương</option><option>Bảo</option></select></label>
          <label>Deposit / seat<input defaultValue="100,000 VND" /></label>
          <label>Hold TTL<input value="15 minutes" readOnly /></label>
          <label className="span-2">Cancellation<input value="100% refund ≥24h · non-refundable <24h / no-show" readOnly /></label>
        </div>
        <div className="builder-boundary"><b>Public landing is automatic.</b><span>Template copy/media comes from the selected Painting or Piano Song. Date, time, capacity, facilitator and commercial terms come from this Session.</span><code style={{ display: "block", marginTop: 8, overflowWrap: "anywhere" }}>afterwork.pinohouse.art/session/{landingSlugPreview}</code></div>
        <div className="builder-boundary"><b>Session owns occurrence data.</b><span>The selected Painting/Piano Song remains reusable and unchanged for future sessions.</span></div>
        <div className="form-actions"><button className="button secondary" type="button" onClick={() => setBuilderOpen(false)}>Cancel</button><button className="button" type="button" onClick={createPrototypeSession}>Create mock session</button></div>
        <p className="hint">Prototype only — this creates client state, not a Core session, public route or payment obligation.</p>
      </section>
    </div>}
  </div>;
}

function Overview({ sessions, totals, holds, confirmed, onNewSession }: { sessions: SessionRow[]; totals: { booked: number; capacity: number }; holds: number; confirmed: number; onNewSession: () => void }) {
  return <section className="afterwork-stack">
    <div className="ops-grid afterwork-metrics"><Metric n={String(sessions.length)} label="Upcoming sessions" /><Metric n={`${totals.booked}/${totals.capacity}`} label="Live seats" /><Metric n={String(holds)} label="Active 15m holds" /><Metric n={String(confirmed)} label="Confirmed / attended" /></div>
    <section className="panel afterwork-panel"><div className="afterwork-panel-head"><div><span className="muted">22–23 August</span><h2>This weekend</h2></div><button className="button" type="button" onClick={onNewSession}>+ New session</button></div><SessionTable sessions={sessions.slice(0, 4)} /></section>
    <div className="afterwork-two-col"><section className="panel"><span className="muted">Attention</span><h2>Needs a look</h2><div className="attention-list"><div><b>Linh · Rainy Window</b><span>HOLDING · expires 10:50</span></div><div><b>Khoa · Always With Me</b><span>HOLDING · expires 10:42</span></div><div><b>Mai · Kiss The Rain</b><span>Late payment after EXPIRED · reconcile / refund</span></div></div></section><section className="panel boundary-card"><span className="muted">Operating boundary</span><h2>Held is not confirmed.</h2><p>Late payment can only confirm after Core atomically reacquires enough capacity. Otherwise it remains non-confirmed and enters reconciliation.</p></section></div>
  </section>;
}

function Sessions({ sessions, onNewSession }: { sessions: SessionRow[]; onNewSession: () => void }) {
  return <section className="afterwork-stack">
    <section className="panel afterwork-panel"><div className="afterwork-panel-head"><div><span className="muted">Occurrence registry</span><h2>Sessions</h2><p className="afterwork-copy">A Session is one dated run. Publishing it exposes one focused public landing through the shared template.</p></div><button className="button" type="button" onClick={onNewSession}>+ New session</button></div><SessionTable sessions={sessions} /></section>
    <section className="panel session-rule"><div><span className="eyebrow">Definition</span><h2>Library item ≠ Session ≠ webpage copy.</h2></div><p>Offering content remains reusable. Session owns occurrence/commercial data. The public app composes both into one landing template instead of staff rebuilding pages for every date.</p></section>
  </section>;
}

function SessionTable({ sessions }: { sessions: SessionRow[] }) {
  return <div className="session-table"><div className="session-row session-head"><span>Occurrence</span><span>Library source</span><span>When</span><span>Capacity</span><span>Status</span></div>{sessions.map((session) => <div className="session-row" key={session.id}><span><b>{session.id}</b><small>{session.publicSlug ? `/session/${session.publicSlug}` : "Landing not reserved"}</small></span><span><b>{session.sourceTitle}</b><small>{session.collection} · {session.facilitator}</small></span><span><b>{session.day}</b><small>{session.time} · deposit {session.deposit}</small></span><span><b>{session.booked}/{session.capacity}</b><small>{session.capacity - session.booked} seats left</small></span><span><em className={`status ${session.status === "Published" ? "status-published" : "status-draft"}`}>{session.status}</em>{session.publicSlug && session.status === "Published" && <a href={`http://localhost:3003/session/${session.publicSlug}`} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11 }}>Preview landing ↗</a>}</span></div>)}</div>;
}

function Paintings({ onCreate }: { onCreate: (title: string) => void }) {
  const collections = Array.from(new Set(paintings.map((item) => item.collection)));
  return <section className="afterwork-stack"><div className="library-header"><div><span className="eyebrow">Reusable library</span><h2>Paintings</h2><p>16 painting definitions. A painting can appear in many dated sessions.</p></div><span className="library-count">16 items · 4 collections</span></div>{collections.map((collection) => <section className="panel library-section" key={collection}><div className="afterwork-panel-head"><div><span className="muted">Collection</span><h2>{collection}</h2></div><span className="muted">4 paintings</span></div><div className="painting-grid">{paintings.filter((item) => item.collection === collection).map((item) => <article className="painting-card" key={item.title}><div className="painting-art" style={{ background: item.visual }} /><div><small>{item.mood}</small><h3>{item.title}</h3><span>Painting library item</span><button className="button secondary" type="button" onClick={() => onCreate(item.title)}>Create session</button></div></article>)}</div></section>)}</section>;
}

function PianoSongs({ onCreate }: { onCreate: (title: string) => void }) {
  const collections = Array.from(new Set(pianoSongs.map((item) => item.collection)));
  return <section className="afterwork-stack"><div className="library-header"><div><span className="eyebrow">Reusable library</span><h2>Piano Songs</h2><p>Song is a reusable content item. Journey and dated sessions reference the song; the song itself has no booking lifecycle.</p></div><span className="library-count">9 songs · 3 collections</span></div>{collections.map((collection) => <section className="panel library-section" key={collection}><div className="afterwork-panel-head"><div><span className="muted">Collection</span><h2>{collection}</h2></div><span className="muted">Discovery grouping only</span></div><div className="song-library-grid">{pianoSongs.filter((item) => item.collection === collection).map((item) => <article className="song-library-card" key={item.title}><div><small>{item.mood}</small><h3>{item.title}</h3><span>Piano Song library item</span></div><button className="button secondary" type="button" onClick={() => onCreate(item.title)}>Create session</button></article>)}</div></section>)}</section>;
}

function Bookings({ bookings }: { bookings: Booking[] }) {
  return <section className="panel afterwork-panel"><div className="afterwork-panel-head"><div><span className="muted">Session-scoped reservations</span><h2>Bookings</h2></div><button className="button secondary" type="button">+ Manual hold</button></div><div className="booking-table"><div className="booking-row booking-head"><span>Name</span><span>Party</span><span>Session occurrence</span><span>Status</span></div>{bookings.map((booking) => <div className="booking-row" key={booking.id}><b>{booking.name}</b><span>{booking.party}</span><span><b>{booking.sessionId}</b><small>{booking.sessionLabel}</small></span><span className={`status ${["confirmed", "attended"].includes(booking.status) ? "status-confirmed" : booking.status === "holding" ? "status-holding" : "status-cancelled"}`}>{statusLabel(booking.status)}{booking.holdUntil ? ` · until ${booking.holdUntil}` : ""}{booking.paymentIssue ? " · RECONCILE" : ""}</span></div>)}</div><p className="hint">Bookings never point directly to a Painting or Piano Song; they reserve seats in one Session occurrence.</p></section>;
}

function Checkin({ bookings, toggle }: { bookings: Booking[]; toggle: (id: string) => void }) {
  return <section className="panel afterwork-panel checkin-panel"><div className="afterwork-panel-head"><div><span className="muted">AW-0823-A · Sun 23 Aug · 14:30</span><h2>Rainy Window</h2><p className="afterwork-copy">Confirmed participants only</p></div><span className="library-count">{bookings.length} eligible</span></div><div className="checkin-list">{bookings.map((booking) => <button key={booking.id} type="button" onClick={() => toggle(booking.id)} className={booking.status === "attended" ? "checked" : ""}><span className="checkmark">{booking.status === "attended" ? "✓" : ""}</span><span><b>{booking.name}</b><small>{booking.party} · {statusLabel(booking.status)}</small></span></button>)}</div><p className="hint">HOLDING, EXPIRED and reconciliation bookings never enter check-in until a valid Core confirmation exists.</p></section>;
}

function PianoJourneys() {
  return <section className="afterwork-stack"><div className="ops-grid afterwork-metrics"><Metric n="7" label="Active journeys" /><Metric n="2" label="Near performance" /><Metric n="3" label="Vinyl pending" /><Metric n="1" label="NFC release ready" /></div><section className="panel afterwork-panel"><div className="afterwork-panel-head"><div><span className="muted">Piano Spa</span><h2>Active journeys</h2></div></div><div className="journey-list"><Journey name="Linh" song="Always With Me" stage="Expression" pct="72%" /><Journey name="Khoa" song="Kiss The Rain" stage="Two Hands" pct="44%" /><Journey name="Mai" song="One Summer’s Day" stage="Performance" pct="91%" /></div></section></section>;
}

function Journey({ name, song, stage, pct }: { name: string; song: string; stage: string; pct: string }) {
  return <article><div><small>{name}</small><h3>{song}</h3><span>{stage}</span></div><div className="journey-progress"><i style={{ width: pct }} /><span>{pct}</span></div><button className="button secondary" type="button">Open</button></article>;
}

function Metric({ n, label }: { n: string; label: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{n}</strong></div>;
}

function statusLabel(status: BookingStatus) {
  return ({ holding: "HOLDING", confirmed: "CONFIRMED", expired: "EXPIRED", cancelled: "CANCELLED", attended: "ATTENDED", no_show: "NO SHOW" })[status];
}

function makeLandingSlug(title: string, date: string) {
  const titlePart = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const parsed = new Date(`${date}T12:00:00`);
  const datePart = parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toLowerCase().replace(/\s+/g, "-");
  return `${titlePart}-${datePart}`;
}
