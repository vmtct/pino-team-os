"use client";
/* eslint-disable @next/next/no-img-element -- prototype composes transparent remote layer assets directly */
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./wardrobe-admin-prototype.module.css";

type Slot = "HEAD_HAIR" | "FACE" | "HEADWEAR" | "OUTFIT" | "BACK";
type Layer = "back" | "outfit" | "hair" | "face" | "headwear" | "eyewear";
type Variant = { id: string; name: string; slot: Slot; kind?: string; asset: string; thumb?: string; layers: Partial<Record<Layer, string>> };
type WardState = { owned: string[]; loadout: Record<Slot, string | null> };
type Learner = { id: string; name: string; meta: string; state: WardState };
const STORAGE = "pino.prototype.pnr-ward.f1-team.v1";
const ASSET = "https://pino-asset-publisher.minhtri-van42.workers.dev/assets/pinoria/assets";
const slots: { id: Slot; label: string; short: string }[] = [
  { id: "HEAD_HAIR", label: "Tóc", short: "Hair" }, { id: "FACE", label: "Mặt · kính", short: "Face" },
  { id: "HEADWEAR", label: "Nón", short: "Headwear" }, { id: "OUTFIT", label: "Trang phục", short: "Outfit" }, { id: "BACK", label: "Lưng", short: "Back" },
];
const catalog: Variant[] = [
  v("hair-basic", "Tóc Cơ Bản", "HEAD_HAIR", `${ASSET}/hair-01/v001/layer.png`, { hair: `${ASSET}/hair-01/v001/layer.png` }),
  v("hair-long", "Tóc Dài Nâu Gợn Sóng", "HEAD_HAIR", `${ASSET}/hair-long-brown-wavy-headband/v001/standalone.png`, { hair: `${ASSET}/hair-long-brown-wavy-headband/v001/layer.png` }),
  v("face-smile", "Gương mặt Mỉm Cười", "FACE", `${ASSET}/face-01/v001/standalone.png`, { face: `${ASSET}/face-01/v001/layer.png` }, "Expression"),
  v("face-playful", "Gương mặt Tinh Nghịch", "FACE", `${ASSET}/face-02/v001/standalone.png`, { face: `${ASSET}/face-02/v001/layer.png` }, "Expression"),
  v("face-stars", "Kính Sao + Mỉm Cười", "FACE", `${ASSET}/star-glasses/v001/layer.png`, { face: `${ASSET}/face-01/v001/layer.png`, eyewear: `${ASSET}/star-glasses/v001/layer.png` }, "Eyewear composition"),
  v("birthday-hat", "Nón Sinh Nhật", "HEADWEAR", `${ASSET}/birthday-hat/v001/layer.png`, { headwear: `${ASSET}/birthday-hat/v001/layer.png` }),
  v("painting-outfit", "Trang phục Hội Họa I", "OUTFIT", `${ASSET}/painting-outfit-01/v001/standalone.png`, { outfit: `${ASSET}/painting-outfit-01/v001/layer.png` }),
  v("hologram-wings", "Cánh Hologram", "BACK", `${ASSET}/hologram-wings/v001/layer.png`, { back: `${ASSET}/hologram-wings/v001/layer.png` }),
];
const fixtures: Learner[] = [
  { id: "lrn_bo", name: "Bơ", meta: "Dẫn Lộ · II", state: { owned: ["hair-basic", "hair-long", "face-smile", "face-stars", "birthday-hat", "painting-outfit", "hologram-wings"], loadout: loadout("hair-long", "face-stars", "birthday-hat", "painting-outfit", "hologram-wings") } },
  { id: "lrn_an", name: "An", meta: "Mầm Xanh · I", state: { owned: ["hair-basic", "face-smile", "painting-outfit"], loadout: loadout("hair-basic", "face-smile", null, "painting-outfit", null) } },
  { id: "lrn_minh", name: "Minh", meta: "Khởi Hành · I", state: { owned: [], loadout: loadout(null, null, null, null, null) } },
];
function v(id: string, name: string, slot: Slot, asset: string, layers: Variant["layers"], kind?: string): Variant { return { id, name, slot, asset, layers, kind }; }
function loadout(hair: string | null, face: string | null, headwear: string | null, outfit: string | null, back: string | null): WardState["loadout"] { return { HEAD_HAIR: hair, FACE: face, HEADWEAR: headwear, OUTFIT: outfit, BACK: back }; }
function variant(id: string | null) { return id ? catalog.find((item) => item.id === id) ?? null : null; }
function layerConfig(state: WardState, tryOn: Variant | null) {
  const active = { ...state.loadout, ...(tryOn ? { [tryOn.slot]: tryOn.id } : {}) };
  return slots.reduce<Partial<Record<Layer, string>>>((acc, slot) => Object.assign(acc, variant(active[slot.id])?.layers ?? {}), {});
}
function persist(value: Record<string, WardState>) { localStorage.setItem(STORAGE, JSON.stringify(value)); }
export function WardrobeAdminPrototype({ basePath = "/bo/pinoria-wardrobe-prototype" }: { basePath?: string } = {}) {
  const router = useRouter(), params = useSearchParams(), learnerId = params.get("learnerId");
  const [store, setStore] = useState<Record<string, WardState>>(() => Object.fromEntries(fixtures.map((item) => [item.id, item.state])));
  const [learnerQuery, setLearnerQuery] = useState(""), [filter, setFilter] = useState<Slot | "ALL">("ALL"), [selectedId, setSelectedId] = useState<string | null>(null);
  const [tryOnId, setTryOnId] = useState<string | null>(null), [grantOpen, setGrantOpen] = useState(false), [grantQuery, setGrantQuery] = useState(""), [notice, setNotice] = useState("");
  useEffect(() => { try { const saved = localStorage.getItem(STORAGE); if (saved) setStore((current) => ({ ...current, ...JSON.parse(saved) })); } catch {} }, []);
  useEffect(() => { setSelectedId(null); setTryOnId(null); setNotice(""); }, [learnerId]);
  const learner = fixtures.find((item) => item.id === learnerId) ?? null, state = learner ? store[learner.id] ?? learner.state : null;
  const owned = useMemo(() => state ? catalog.filter((item) => state.owned.includes(item.id)) : [], [state]);
  const visibleOwned = owned.filter((item) => filter === "ALL" || item.slot === filter), selected = variant(selectedId), tryOn = variant(tryOnId);
  const learnerRows = fixtures.filter((item) => item.name.toLocaleLowerCase("vi").includes(learnerQuery.trim().toLocaleLowerCase("vi")));
  const grantRows = catalog.filter((item) => item.name.toLocaleLowerCase("vi").includes(grantQuery.trim().toLocaleLowerCase("vi")));
  function write(next: WardState, message: string) { if (!learner) return; setStore((current) => { const value = { ...current, [learner.id]: next }; persist(value); return value; }); setNotice(message); }
  function equip(item: Variant) { if (!state) return; write({ ...state, loadout: { ...state.loadout, [item.slot]: item.id } }, `${item.name} đã được trang bị.`); setTryOnId(null); }
  function unequip(item: Variant) { if (!state) return; write({ ...state, loadout: { ...state.loadout, [item.slot]: null } }, `${item.name} đã được gỡ khỏi loadout.`); setTryOnId(null); }
  function grant(item: Variant) { if (!state || state.owned.includes(item.id)) return; write({ ...state, owned: [...state.owned, item.id] }, `${item.name} đã được cấp. Loadout không thay đổi.`); setSelectedId(item.id); setGrantOpen(false); }
  if (!learner || !state) return <LearnerPicker query={learnerQuery} setQuery={setLearnerQuery} rows={learnerRows} invalid={Boolean(learnerId)} choose={(id) => router.push(`${basePath}?learnerId=${id}`)} />;
  return <main className={styles.page}><header className={styles.pickerIntro}><span className={styles.eyebrow}>PNR-WARD · BO PROTOTYPE</span><h2>Wardrobe Admin · {learner.name}</h2><p>Full wardrobe management. Production access requires pinoria.wardrobe.manage / grant.</p></header>
      <section className={styles.learnerBar}><button className={styles.learnerIdentity} onClick={() => router.push(basePath)}><span>{learner.name.charAt(0)}</span><div><strong>{learner.name}</strong><small>{learner.meta} · Đổi học viên</small></div><b>⌄</b></button><button className={styles.grantButton} onClick={() => setGrantOpen(true)}>＋ Cấp món</button></section>
      {notice ? <div className={styles.notice}>{notice}<button onClick={() => setNotice("")}>×</button></div> : null}
      <section className={styles.previewCard}><div className={styles.previewHead}><div><span className={styles.eyebrow}>{tryOn ? "ĐANG THỬ" : "LOADOUT HIỆN TẠI"}</span><strong>{tryOn?.name ?? "Diện mạo của " + learner.name}</strong></div>{tryOn ? <button onClick={() => setTryOnId(null)}>Bỏ thử</button> : null}</div><CharacterPreview name={learner.name} layers={layerConfig(state, tryOn)} /></section>
      <section className={styles.slotSection}><div className={styles.sectionTitle}><strong>5 slot đang dùng</strong><small>Chạm slot để xem món hiện tại</small></div><div className={styles.slotRail}>{slots.map((slot) => { const item = variant(state.loadout[slot.id]); return <button key={slot.id} className={item && selectedId === item.id ? styles.slotActive : undefined} onClick={() => { setFilter(slot.id); setSelectedId(item?.id ?? null); setTryOnId(null); }}><span>{item ? <img src={item.asset} alt="" /> : "+"}</span><small>{slot.label}</small></button>; })}</div></section>
      <section className={styles.inventorySection}><div className={styles.sectionTitle}><div><strong>Đã sở hữu</strong><small>{owned.length} wearable</small></div></div><div className={styles.filters}><button className={filter === "ALL" ? styles.filterActive : undefined} onClick={() => setFilter("ALL")}>Tất cả</button>{slots.map((slot) => <button key={slot.id} className={filter === slot.id ? styles.filterActive : undefined} onClick={() => setFilter(slot.id)}>{slot.label}</button>)}</div>
        {!visibleOwned.length ? <div className={styles.empty}>Chưa sở hữu món nào trong nhóm này.</div> : <div className={styles.itemGrid}>{visibleOwned.map((item) => { const equipped = state.loadout[item.slot] === item.id; return <button key={item.id} className={`${styles.itemCard} ${selectedId === item.id ? styles.itemActive : ""}`} onClick={() => { setSelectedId(item.id); setTryOnId(item.id); }}><span className={styles.itemImage}><img src={item.asset} alt="" />{equipped ? <b>✓</b> : null}</span><strong>{item.name}</strong><small>{equipped ? "Đang dùng" : item.kind ?? slots.find((slot) => slot.id === item.slot)?.short}</small></button>; })}</div>}
      </section>
      {selected && state.owned.includes(selected.id) ? <ItemDock item={selected} equipped={state.loadout[selected.slot] === selected.id} trying={tryOnId === selected.id} onTry={() => setTryOnId(selected.id)} onEquip={() => equip(selected)} onUnequip={() => unequip(selected)} /> : null}
      {grantOpen ? <GrantSheet learner={learner} state={state} query={grantQuery} setQuery={setGrantQuery} rows={grantRows} onClose={() => setGrantOpen(false)} onGrant={grant} /> : null}
    </main>;
}
function LearnerPicker({ query, setQuery, rows, invalid, choose }: { query: string; setQuery: (value: string) => void; rows: Learner[]; invalid: boolean; choose: (id: string) => void }) {
  return <main className={styles.page}><section className={styles.pickerIntro}><span className={styles.eyebrow}>PNR-WARD · PROTOTYPE</span><h2>Wardrobe của ai?</h2><p>Prototype dùng local fixture. Không gọi Core và không thay đổi dữ liệu thật.</p></section>{invalid ? <div className={styles.warning}>Learner trong URL không tồn tại trong fixture. Hãy chọn lại.</div> : null}<input className={styles.search} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên học viên…"/><section className={styles.learnerList}>{rows.map((learner) => <button key={learner.id} onClick={() => choose(learner.id)}><span>{learner.name.charAt(0)}</span><div><strong>{learner.name}</strong><small>{learner.meta} · {learner.state.owned.length} món sở hữu</small></div><b>→</b></button>)}</section></main>;
}
function CharacterPreview({ name, layers }: { name: string; layers: Partial<Record<Layer, string>> }) {
  const order: Layer[] = ["back", "outfit", "hair", "face", "headwear", "eyewear"], values = order.map((key) => layers[key]).filter(Boolean) as string[];
  return <div className={styles.characterStage} aria-label={`Preview wardrobe của ${name}`} role="img"><div className={styles.baseGhost}><span>{name.charAt(0)}</span><small>base avatar</small></div>{values.map((src, index) => <img key={`${index}-${src}`} src={src} alt="" draggable={false} />)}</div>;
}
function ItemDock({ item, equipped, trying, onTry, onEquip, onUnequip }: { item: Variant; equipped: boolean; trying: boolean; onTry: () => void; onEquip: () => void; onUnequip: () => void }) {
  return <section className={styles.itemDock}><div><span className={styles.eyebrow}>{trying && !equipped ? "ĐANG THỬ" : equipped ? "ĐANG DÙNG" : "ĐÃ SỞ HỮU"}</span><strong>{item.name}</strong><small>{slots.find((slot) => slot.id === item.slot)?.label}{item.kind ? ` · ${item.kind}` : ""}</small></div><div className={styles.dockActions}>{!trying && !equipped ? <button className={styles.secondary} onClick={onTry}>Thử</button> : null}{equipped ? <button className={styles.secondary} onClick={onUnequip}>Gỡ</button> : <button className={styles.primary} onClick={onEquip}>Trang bị</button>}</div></section>;
}
function GrantSheet({ learner, state, query, setQuery, rows, onClose, onGrant }: { learner: Learner; state: WardState; query: string; setQuery: (value: string) => void; rows: Variant[]; onClose: () => void; onGrant: (item: Variant) => void }) {
  const [slot, setSlot] = useState<Slot | "ALL">("ALL"), visible = rows.filter((item) => slot === "ALL" || item.slot === slot);
  return <div className={styles.sheetBackdrop} role="dialog" aria-modal="true" aria-label="Cấp wearable"><section className={styles.sheet}><header><div><span className={styles.eyebrow}>GRANT WEARABLE</span><h2>Cấp món cho {learner.name}</h2><p>Chỉ thêm ownership. Không tự trang bị.</p></div><button className={styles.close} onClick={onClose}>×</button></header><input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm wearable…"/><div className={styles.filters}><button className={slot === "ALL" ? styles.filterActive : undefined} onClick={() => setSlot("ALL")}>Tất cả</button>{slots.map((entry) => <button key={entry.id} className={slot === entry.id ? styles.filterActive : undefined} onClick={() => setSlot(entry.id)}>{entry.label}</button>)}</div><div className={styles.grantList}>{visible.map((item) => { const owned = state.owned.includes(item.id); return <article key={item.id}><span><img src={item.asset} alt="" /></span><div><strong>{item.name}</strong><small>{slots.find((entry) => entry.id === item.slot)?.label}{item.kind ? ` · ${item.kind}` : ""}</small></div><button disabled={owned} onClick={() => onGrant(item)}>{owned ? "Đã có" : "Cấp"}</button></article>; })}</div></section></div>;
}

