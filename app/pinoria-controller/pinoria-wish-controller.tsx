"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WISH_CONTROL_URL = "/api/pinoria-prototype/wish-control";

type Learner = {
  studentProfileId: string;
  displayName: string;
  visit: { id: string; checkedInAt: string; version: number };
  character: { id: string; config: Record<string, string> };
};

type Banner = {
  id: string;
  displayName: string;
  storyHook: string;
  bearer: { displayName: string; title: string };
  signatureSet: { displayName: string };
  guarantees: {
    mythicSoftPityStartsAt: number;
    mythicWithin: number;
    rareWithin: number;
    featuredMythicRate: number;
    perfectMemoryRate: number;
  };
};

type WishSnapshot = { centerId: string; learners: Learner[]; banners: Banner[] };

type WishState = {
  energySeedBalance: number;
  canDrawOne: boolean;
  canDrawFive: boolean;
  pity: {
    mythicSinceLastHit: number;
    mythicSoftPityStartsAt: number;
    mythicGuaranteedWithin: number;
    rareSinceLastHit: number;
    rareGuaranteedWithin: number;
    featuredGuarantee: boolean;
  };
  bearer: { id: string; resonanceLevel: number };
  signatureSet: { progress: { owned: number; total: number } };
};

type DrawResult = {
  drawId: string;
  seedSpent: number;
  energySeedBalanceAfter: number;
  pulls: Array<{
    rarity: "COMMON" | "RARE" | "MYTHIC";
    featured: boolean;
    perfectMemory: boolean;
  }>;
};

type ApiFailure = { code?: string; message?: string };

function errorCode(body: unknown): string {
  if (!body || typeof body !== "object") return "REQUEST_FAILED";
  const value = body as { error?: string | ApiFailure };
  if (typeof value.error === "string") return value.error;
  return value.error?.code ?? "REQUEST_FAILED";
}

function friendly(code: string) {
  if (code.includes("STAFF_PIN") || code === "UNAUTHORIZED") return "Phiên PIN nhân sự chưa hợp lệ hoặc đã hết hạn.";
  if (code === "CONTROLLER_LEASE_REQUIRED") return "Quyền điều khiển Reception TV đang thuộc nhân sự khác.";
  if (code.includes("INSUFFICIENT_ENERGY_SEEDS")) return "Học viên không đủ Hạt Năng Lượng cho lượt gieo này.";
  if (code.includes("BANNER_UNAVAILABLE")) return "Dư Âm này hiện không còn hoạt động.";
  if (code.includes("VISIT_CONTEXT")) return "Học viên không còn open Visit tại PINO House.";
  if (code === "WISH_CORE_UNAVAILABLE") return "Wish Core chưa sẵn sàng ở môi trường này.";
  return "Không thể hoàn tất thao tác Gieo Ước.";
}

async function post(body: Record<string, unknown>) {
  const response = await fetch(WISH_CONTROL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, payload };
}

export function PinoriaWishController({
  staffToken,
  clientId,
  ownsLease,
}: {
  staffToken: string;
  clientId: string;
  ownsLease: boolean;
}) {
  const [pin, setPin] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [snapshot, setSnapshot] = useState<WishSnapshot | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedBannerId, setSelectedBannerId] = useState("");
  const [state, setState] = useState<WishState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DrawResult | null>(null);
  const snapshotInFlight = useRef(false);
  const pendingDrawRef = useRef<{ key: string; learnerId: string; bannerId: string; count: 1 | 5 } | null>(null);

  const learner = useMemo(
    () => snapshot?.learners.find((item) => item.studentProfileId === selectedLearnerId) ?? snapshot?.learners[0] ?? null,
    [snapshot, selectedLearnerId],
  );
  const banner = useMemo(
    () => snapshot?.banners.find((item) => item.id === selectedBannerId) ?? snapshot?.banners[0] ?? null,
    [snapshot, selectedBannerId],
  );

  async function loadSnapshot(silent = false) {
    if (snapshotInFlight.current) return false;
    snapshotInFlight.current = true;
    try {
      const { response, payload } = await post({ op: "snapshot" });
      if (!response.ok) {
        const code = errorCode(payload);
        if (response.status === 401) setSessionReady(false);
        if (!silent) setError(friendly(code));
        return false;
      }
      const data = payload.data as WishSnapshot;
      setSnapshot(data);
      setSessionReady(true);
      setError("");
      setSelectedLearnerId((current) => data.learners.some((item) => item.studentProfileId === current) ? current : data.learners[0]?.studentProfileId ?? "");
      setSelectedBannerId((current) => data.banners.some((item) => item.id === current) ? current : data.banners[0]?.id ?? "");
      return true;
    } catch {
      if (!silent) setError("Không kết nối được Wish Core.");
      return false;
    } finally {
      snapshotInFlight.current = false;
    }
  }

  async function loadState(silent = false) {
    if (!learner || !banner || !sessionReady) {
      setState(null);
      return;
    }
    try {
      const { response, payload } = await post({
        op: "state",
        studentProfileId: learner.studentProfileId,
        bannerId: banner.id,
      });
      if (!response.ok) {
        const code = errorCode(payload);
        if (response.status === 401) setSessionReady(false);
        if (!silent) setError(friendly(code));
        return;
      }
      setState(payload.data as WishState);
      if (!silent) setError("");
    } catch {
      if (!silent) setError("Không đọc được trạng thái Gieo Ước.");
    }
  }

  useEffect(() => {
    void loadSnapshot(true);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void loadState(true);
  }, [sessionReady, learner?.studentProfileId, banner?.id]);

  useEffect(() => {
    if (!sessionReady) return;
    const timer = window.setInterval(() => {
      void loadSnapshot(true).then(() => loadState(true));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [sessionReady, learner?.studentProfileId, banner?.id]);

  async function login() {
    if (!/^\d{6}$/.test(pin) || busy) return;
    setBusy(true);
    setError("");
    try {
      const { response, payload } = await post({ op: "login", staffToken, pin });
      if (!response.ok) {
        setError(friendly(errorCode(payload)));
        return;
      }
      setPin("");
      setSessionReady(true);
      await loadSnapshot();
    } catch {
      setError("Không thể xác thực PIN nhân sự.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await post({ op: "logout" }).catch(() => undefined);
    setSessionReady(false);
    setSnapshot(null);
    setState(null);
    setResult(null);
    pendingDrawRef.current = null;
    setPin("");
  }

  async function draw(count: 1 | 5) {
    if (!learner || !banner || !state || !clientId || !ownsLease || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    const pending = pendingDrawRef.current;
    const sameAttempt = pending
      && pending.learnerId === learner.studentProfileId
      && pending.bannerId === banner.id
      && pending.count === count;
    const idempotencyKey = sameAttempt ? pending.key : crypto.randomUUID();
    if (!sameAttempt) {
      pendingDrawRef.current = { key: idempotencyKey, learnerId: learner.studentProfileId, bannerId: banner.id, count };
    }
    try {
      const { response, payload } = await post({
        op: "draw",
        staffToken,
        clientId,
        studentProfileId: learner.studentProfileId,
        bannerId: banner.id,
        count,
        idempotencyKey,
      });
      if (!response.ok) {
        pendingDrawRef.current = null;
        const code = errorCode(payload);
        if (response.status === 401) setSessionReady(false);
        setError(friendly(code));
        await loadState(true);
        return;
      }
      pendingDrawRef.current = null;
      setResult(payload.data as DrawResult);
      await loadState(true);
    } catch {
      setError("Kết nối bị gián đoạn. Bấm lại cùng nút để Core replay đúng lượt vừa gửi.");
      await loadState(true);
    } finally {
      setBusy(false);
    }
  }

  if (!sessionReady) {
    return (
      <section style={panelStyle} aria-label="Pinoria Wish Core authentication">
        <div style={headStyle}>
          <div><span style={kickerStyle}>GIEO ƯỚC · CORE</span><strong style={titleStyle}>Xác thực PIN nhân sự</strong></div>
          <span style={coreBadge}>PRIVATE TOS</span>
        </div>
        <p style={copyStyle}>Nhập PIN 6 số để mở trạng thái Hạt Năng Lượng và quyền Gieo Ước. PIN không được gửi xuống TV.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            aria-label="PIN nhân sự"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            maxLength={6}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(event) => { if (event.key === "Enter") void login(); }}
            style={pinStyle}
          />
          <button type="button" disabled={busy || !/^\d{6}$/.test(pin)} onClick={() => void login()} style={primaryButton}>
            {busy ? "Đang xác thực…" : "Mở Gieo Ước"}
          </button>
        </div>
        {error ? <div style={errorStyle}>{error}</div> : null}
      </section>
    );
  }

  const resonance = state?.bearer.resonanceLevel ?? -1;
  const resonanceLabel = resonance < 0 ? "Chưa Cộng Hưởng" : `C${resonance}`;
  const canOne = !!state?.canDrawOne && ownsLease && !busy;
  const canFive = !!state?.canDrawFive && ownsLease && !busy;
  const mythicPosition = state ? state.pity.mythicSinceLastHit + 1 : 1;

  return (
    <section style={panelStyle} aria-label="Pinoria Wish controller">
      <div style={headStyle}>
        <div><span style={kickerStyle}>GIEO ƯỚC · CORE</span><strong style={titleStyle}>{banner?.displayName ?? "Chưa có Dư Âm hoạt động"}</strong></div>
        <button type="button" onClick={() => void logout()} style={ghostButton}>Khoá PIN</button>
      </div>

      <div style={selectorGrid}>
        <label style={fieldStyle}>
          <span>HỌC VIÊN ĐANG Ở HOUSE</span>
          <select value={learner?.studentProfileId ?? ""} onChange={(event) => { setSelectedLearnerId(event.target.value); setResult(null); }} style={selectStyle}>
            {!snapshot?.learners.length ? <option value="">Không có open Visit</option> : null}
            {snapshot?.learners.map((item) => <option key={item.studentProfileId} value={item.studentProfileId}>{item.displayName}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          <span>DƯ ÂM</span>
          <select value={banner?.id ?? ""} onChange={(event) => { setSelectedBannerId(event.target.value); setResult(null); }} style={selectStyle}>
            {!snapshot?.banners.length ? <option value="">Không có banner active</option> : null}
            {snapshot?.banners.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        </label>
      </div>

      <div style={statsGrid}>
        <Stat label="HẠT NĂNG LƯỢNG" value={state ? String(state.energySeedBalance) : "—"} />
        <Stat label="CỘNG HƯỞNG" value={resonanceLabel} />
        <Stat label="BỘ KÝ ỨC" value={state ? `${state.signatureSet.progress.owned}/${state.signatureSet.progress.total}` : "—"} />
        <Stat label="HUYỀN THOẠI" value={state ? `${mythicPosition}/${state.pity.mythicGuaranteedWithin}` : "—"} />
      </div>

      {state ? (
        <div style={metaStyle}>
          <span>Rare ≤ {state.pity.rareGuaranteedWithin}</span>
          <span>Soft Mythic từ {state.pity.mythicSoftPityStartsAt}</span>
          <span>{state.pity.featuredGuarantee ? "Featured kế tiếp được bảo chứng" : "Featured 50/50"}</span>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <button type="button" disabled={!canOne} onClick={() => void draw(1)} style={primaryButton}>
          {busy ? "Đang chốt…" : "Gieo ×1"}
        </button>
        <button type="button" disabled={!canFive} onClick={() => void draw(5)} style={primaryButton}>
          {busy ? "Đang chốt…" : "Gieo ×5"}
        </button>
      </div>
      {!ownsLease ? <p style={copyStyle}>Nhận quyền điều khiển Reception TV trước khi Gieo Ước.</p> : null}
      {result ? (
        <div style={successStyle}>
          <strong>Kết quả đã được Core chốt · TV sẽ tự phát</strong>
          <span>{result.pulls.length} ký ức · còn {result.energySeedBalanceAfter} Hạt</span>
        </div>
      ) : null}
      {error ? <div style={errorStyle}>{error}</div> : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={statStyle}><span>{label}</span><strong>{value}</strong></div>;
}

const panelStyle = {
  margin: "10px 12px 0",
  padding: 12,
  borderRadius: 18,
  border: "1px solid rgba(216,192,112,.22)",
  background: "linear-gradient(145deg,rgba(32,47,39,.88),rgba(22,31,28,.94))",
  boxShadow: "inset 0 1px rgba(255,255,255,.04)",
} as const;
const headStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 } as const;
const kickerStyle = { display: "block", fontSize: 8, fontWeight: 900, letterSpacing: ".14em", color: "#d9c57b" } as const;
const titleStyle = { display: "block", marginTop: 3, fontSize: 13, color: "#f4efe3" } as const;
const coreBadge = { padding: "5px 7px", borderRadius: 999, border: "1px solid rgba(216,192,112,.2)", color: "rgba(230,216,164,.7)", fontSize: 8, fontWeight: 900 } as const;
const copyStyle = { margin: "8px 0 0", color: "rgba(241,235,221,.5)", fontSize: 9, lineHeight: 1.5 } as const;
const pinStyle = { flex: 1, minWidth: 0, padding: "10px 11px", borderRadius: 12, border: "1px solid rgba(255,255,255,.13)", background: "rgba(0,0,0,.2)", color: "#f8f2e5", fontSize: 15, letterSpacing: ".25em", outline: "none" } as const;
const primaryButton = { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(228,207,132,.36)", background: "linear-gradient(145deg,#ead88f,#cbb46d)", color: "#272419", fontSize: 10, fontWeight: 900 } as const;
const ghostButton = { padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(255,255,255,.11)", background: "rgba(0,0,0,.12)", color: "rgba(244,239,226,.62)", fontSize: 8, fontWeight: 800 } as const;
const selectorGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 11 } as const;
const fieldStyle = { minWidth: 0, display: "grid", gap: 4, color: "rgba(230,219,180,.48)", fontSize: 7, fontWeight: 900, letterSpacing: ".09em" } as const;
const selectStyle = { width: "100%", minWidth: 0, padding: "9px 8px", borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "#17201c", color: "#eee9dc", fontSize: 9 } as const;
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginTop: 10 } as const;
const statStyle = { minWidth: 0, padding: "8px 6px", borderRadius: 10, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.06)", textAlign: "center" as const };
const metaStyle = { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 8, color: "rgba(241,235,221,.4)", fontSize: 7 } as const;
const successStyle = { display: "grid", gap: 2, marginTop: 9, padding: "9px 10px", borderRadius: 11, background: "rgba(112,150,102,.14)", color: "#dcebd2", fontSize: 9 } as const;
const errorStyle = { marginTop: 9, padding: "8px 9px", borderRadius: 10, background: "rgba(178,93,82,.13)", color: "#efc4bb", fontSize: 9 } as const;
