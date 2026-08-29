"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PINORIA_SHOP_RELAY_URL, PINORIA_SHOP_SURFACE_ID, type EnergySeedReward, type PinoriaSurfaceSessionSnapshot } from "../pinoria-tv/shop-types";
import { PinoriaStaffController } from "./pinoria-staff-controller";
import { PinoriaWishController } from "./pinoria-wish-controller";

const CONTROLLER_SESSION_URL = "/api/pinoria-prototype/controller-session";
const CONTROLLER_COMMAND_URL = "/api/pinoria-prototype/controller-command";
const CLIENT_KEY = "pino.pinoria.controller.client-id";

type StaffIdentity = { id: string; name: string };
type PresenceLearner = {
  id: string;
  name: string;
  pls: number;
  path: string;
  room: string;
  companion: string;
  fruit: number;
  checkedInAt: number;
  updatedAt: number;
};
type LeaseView = {
  staffId: string;
  staffName: string;
  acquiredAt: number;
  renewedAt: number;
  expiresAt: number;
};
type EnergySeedView = {
  surfaceId: string;
  learnerId: string;
  status: "available" | "activated";
  reward: EnergySeedReward | null;
  activatedAt: number | null;
  activatedByStaffId: string | null;
  queuedEventId: number | null;
};
type ControllerSnapshot = {
  ok: boolean;
  staff?: StaffIdentity;
  surface?: PinoriaSurfaceSessionSnapshot;
  learners?: PresenceLearner[];
  energySeeds?: EnergySeedView[];
  lease?: LeaseView | null;
  isOwner?: boolean;
  error?: string;
};

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pinoria_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function PinoriaControllerGate({ staffToken, staff }: { staffToken: string; staff: StaffIdentity }) {
  const [clientId, setClientId] = useState("");
  const [snapshot, setSnapshot] = useState<ControllerSnapshot | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [error, setError] = useState("");
  const [leaseBusy, setLeaseBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const acquiringRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CLIENT_KEY);
    const next = stored && stored.length >= 8 ? stored : makeClientId();
    window.localStorage.setItem(CLIENT_KEY, next);
    setClientId(next);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    const originalFetch = window.fetch.bind(window);
    const interceptedFetch: typeof window.fetch = async (input, init) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(raw, window.location.href);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.pathname === PINORIA_SHOP_RELAY_URL && method === "POST") {
        let relayBody: Record<string, unknown> = {};
        if (typeof init?.body === "string") {
          try { relayBody = JSON.parse(init.body) as Record<string, unknown>; } catch { relayBody = {}; }
        }
        return originalFetch(CONTROLLER_COMMAND_URL, {
          ...init,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...relayBody, staffToken, clientId }),
          cache: "no-store",
        });
      }
      return originalFetch(input, init);
    };
    window.fetch = interceptedFetch;
    return () => {
      if (window.fetch === interceptedFetch) window.fetch = originalFetch;
    };
  }, [clientId, staffToken]);

  async function controllerRequest(op: "acquire" | "renew" | "release") {
    if (!clientId) return null;
    try {
      const response = await fetch(CONTROLLER_SESSION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, t: staffToken, clientId, surfaceId: PINORIA_SHOP_SURFACE_ID }),
        cache: "no-store",
      });
      const data = await response.json() as ControllerSnapshot;
      setSnapshot(data);
      if (!response.ok && data.error !== "CONTROLLER_BUSY") {
        setError(data.error === "UNAUTHORIZED" ? "Phiên TOS không còn hợp lệ." : "Không thể nhận quyền điều khiển TV.");
      }
      return data;
    } catch {
      setError("Mất kết nối với controller session.");
      return null;
    }
  }

  async function refresh() {
    if (!clientId) return;
    try {
      const query = new URLSearchParams({
        t: staffToken,
        clientId,
        surfaceId: PINORIA_SHOP_SURFACE_ID,
      });
      const response = await fetch(`${CONTROLLER_SESSION_URL}?${query.toString()}`, { cache: "no-store" });
      const data = await response.json() as ControllerSnapshot;
      if (!response.ok) {
        setError(data.error === "UNAUTHORIZED" ? "Phiên TOS không còn hợp lệ." : "Không đọc được trạng thái controller.");
        return;
      }
      setSnapshot(data);
      setError("");

      if (!data.isOwner && !data.lease && !acquiringRef.current) {
        acquiringRef.current = true;
        void controllerRequest("acquire").finally(() => { acquiringRef.current = false; });
      }
    } catch {
      setError("Không đọc được trạng thái Reception TV.");
    }
  }

  useEffect(() => {
    if (!clientId) return;
    void controllerRequest("acquire");
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1600);
    return () => window.clearInterval(timer);
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !snapshot?.isOwner) return;
    const timer = window.setInterval(() => { void controllerRequest("renew"); }, 5000);
    return () => window.clearInterval(timer);
  }, [clientId, snapshot?.isOwner]);

  useEffect(() => {
    if (!clientId) return;
    const release = () => {
      void fetch(CONTROLLER_SESSION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "release", t: staffToken, clientId, surfaceId: PINORIA_SHOP_SURFACE_ID }),
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [clientId, staffToken]);

  const learners = snapshot?.learners ?? [];
  const surface = snapshot?.surface;
  const ownsLease = !!snapshot?.isOwner;
  const lease = snapshot?.lease ?? null;
  const tvReady = !!surface?.online && surface.baseMode === "ambient";
  const selectedLearner = useMemo(
    () => learners.find((learner) => learner.id === selectedLearnerId) ?? learners[0] ?? null,
    [learners, selectedLearnerId],
  );
  const selectedEnergySeed = selectedLearner
    ? snapshot?.energySeeds?.find((seed) => seed.learnerId === selectedLearner.id) ?? null
    : null;

  useEffect(() => {
    if (!learners.length) {
      setSelectedLearnerId("");
      return;
    }
    setSelectedLearnerId((current) => learners.some((learner) => learner.id === current) ? current : learners[0].id);
  }, [learners]);

  async function issueCommand(op: string, payload: Record<string, unknown>) {
    if (!clientId || !ownsLease) return false;
    const response = await fetch(CONTROLLER_COMMAND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        surfaceId: PINORIA_SHOP_SURFACE_ID,
        op,
        ...payload,
        staffToken,
        clientId,
      }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setError(data.error === "LEARNER_NOT_CHECKED_IN"
        ? "Học viên này đã check-out khỏi House."
        : data.error === "CONTROLLER_LEASE_REQUIRED"
          ? "Quyền điều khiển TV đã chuyển sang nhân sự khác."
          : "Không thể đổi học viên trên TV.");
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (!selectedLearner || !ownsLease || !tvReady) return;
    void issueCommand("set-subject", { subject: selectedLearner });
  }, [selectedLearner?.id, ownsLease, tvReady]);

  async function chooseLearner(id: string) {
    const learner = learners.find((item) => item.id === id);
    if (!learner) return;
    setSelectedLearnerId(id);
    if (ownsLease && tvReady) await issueCommand("set-subject", { subject: learner });
  }

  async function activateSeed() {
    if (!selectedLearner || !clientId || !ownsLease || seedBusy) return;
    setSeedBusy(true);
    setError("");
    try {
      const response = await fetch(CONTROLLER_COMMAND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surfaceId: PINORIA_SHOP_SURFACE_ID,
          op: "activate-energy-seed",
          subject: selectedLearner,
          staffToken,
          clientId,
        }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; activation?: EnergySeedView };
      if (!response.ok || !data.ok) {
        if (data.error === "ENERGY_SEED_ALREADY_ACTIVATED") {
          await refresh();
          return;
        }
        if (data.error === "REWARD_COMMITTED_RELAY_UNAVAILABLE") {
          setError("Phần thưởng đã được chốt nhưng TV chưa nhận được sự kiện. Không kích hoạt lại để tránh reroll.");
          await refresh();
          return;
        }
        setError(data.error === "LEARNER_NOT_CHECKED_IN"
          ? "Học viên đã rời PINO House."
          : data.error === "CONTROLLER_LEASE_REQUIRED"
            ? "Quyền điều khiển TV đã chuyển sang nhân sự khác."
            : "Không thể kích hoạt Hạt Năng Lượng lúc này.");
        return;
      }
      await refresh();
    } catch {
      setError("Không thể kết nối để kích hoạt Hạt Năng Lượng.");
    } finally {
      setSeedBusy(false);
    }
  }

  async function toggleLease() {
    if (leaseBusy || !clientId) return;
    setLeaseBusy(true);
    setError("");
    await controllerRequest(ownsLease ? "release" : "acquire");
    setLeaseBusy(false);
  }

  const interactionLocked = !ownsLease || !selectedLearner;
  const leaseLabel = ownsLease
    ? `Bạn đang điều khiển`
    : lease
      ? `${lease.staffName} đang điều khiển`
      : "TV chưa có người điều khiển";
  const seedActivated = selectedEnergySeed?.status === "activated";
  const seedStatus = !selectedLearner
    ? "Chọn học viên đang ở House"
    : seedActivated
      ? selectedEnergySeed?.queuedEventId
        ? "Đã kích hoạt · đang chờ / đang phát trên TV"
        : "Đã kích hoạt · phần thưởng đã được chốt"
      : "Sẵn sàng kích hoạt";

  return (
    <div className={`p2-controller-shell ${interactionLocked ? "p2-controller-locked" : ""}`}>
      <section className="p2-controller-gate" aria-live="polite">
        <div className="p2-controller-meta">
          <span>TOS · {staff.name}</span>
          <strong>{leaseLabel}</strong>
        </div>
        <div className="p2-controller-presence">
          <label>
            <span>ĐANG Ở PINO HOUSE · {learners.length}</span>
            <select
              value={selectedLearner?.id ?? ""}
              disabled={!ownsLease || !learners.length || leaseBusy}
              onChange={(event) => void chooseLearner(event.target.value)}
            >
              {!learners.length ? <option value="">Chưa có học viên check-in</option> : null}
              {learners.map((learner) => (
                <option key={learner.id} value={learner.id}>{learner.name} · {learner.pls} PLS</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={leaseBusy || (!!lease && !ownsLease)} onClick={() => void toggleLease()}>
            {ownsLease ? "Nhả quyền" : lease ? "Đang bận" : "Nhận quyền"}
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "11px 12px",
            borderRadius: 16,
            border: "1px solid rgba(174,216,255,.19)",
            background: "linear-gradient(135deg,rgba(58,76,102,.24),rgba(58,42,89,.22))",
            boxShadow: "inset 0 1px rgba(255,255,255,.035)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span style={{ display: "block", color: "rgba(185,218,255,.62)", fontSize: 8, fontWeight: 900, letterSpacing: ".13em" }}>HẠT NĂNG LƯỢNG PINORIA</span>
            <strong style={{ display: "block", marginTop: 3, fontSize: 12 }}>{seedStatus}</strong>
            {seedActivated && selectedEnergySeed?.reward ? (
              <small style={{ display: "block", marginTop: 3, color: "rgba(246,232,208,.46)", fontSize: 9 }}>{selectedEnergySeed.reward.label} · kết quả đã cố định</small>
            ) : (
              <small style={{ display: "block", marginTop: 3, color: "rgba(246,232,208,.40)", fontSize: 9 }}>Core chốt phần thưởng trước, sau đó TV mới phát nghi thức.</small>
            )}
          </div>
          <button
            type="button"
            disabled={!ownsLease || !selectedLearner || seedActivated || seedBusy}
            onClick={() => void activateSeed()}
            style={{
              flex: "0 0 auto",
              minWidth: 86,
              padding: "10px 11px",
              borderRadius: 12,
              border: "1px solid rgba(201,228,255,.24)",
              background: seedActivated ? "rgba(92,99,112,.32)" : "linear-gradient(145deg,#dbeeff,#a8c5ee)",
              color: seedActivated ? "rgba(240,236,225,.48)" : "#182333",
              fontWeight: 900,
              fontSize: 10,
              opacity: !ownsLease || !selectedLearner ? .45 : 1,
            }}
          >
            {seedBusy ? "Đang chốt..." : seedActivated ? "Đã kích hoạt" : "Kích hoạt"}
          </button>
        </div>

        {error ? <div className="p2-controller-error">{error}</div> : null}
      </section>
      <PinoriaWishController staffToken={staffToken} clientId={clientId} ownsLease={ownsLease} />
      <PinoriaStaffController />
    </div>
  );
}
