"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LayeredCharacter, type PinoriaCharacterConfig } from "@/app/pinoria-tv/layered-character";
import { resolvePinoriaEffectPresentation } from "@/lib/pinoria-effect-presentation";
import styles from "./pinoria-effects.module.css";

type EffectDefinition = {
  key: string;
  displayName: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  implementationVersion: number;
  description: string;
  capabilities: string[];
  fullAvatarDescription: string;
  houseMiniDescription: string;
};
type Envelope<T> = { data?: T; error?: { message?: string } };

const PREVIEW_CHARACTER: PinoriaCharacterConfig = {
  hair: "pinoria/char-base.png",
  face: "pinoria/char-base.png",
  outfit: "pinoria/char-base.png",
};

async function readCatalog(): Promise<EffectDefinition[]> {
  const response = await fetch("/api/bo/pinoria/effects/catalog", { cache: "no-store" });
  const json = await response.json() as Envelope<EffectDefinition[]>;
  if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Không tải được Effect Catalog");
  return json.data;
}

export function EffectCatalogView() {
  const [catalog, setCatalog] = useState<EffectDefinition[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void readCatalog()
      .then((data) => {
        if (!active) return;
        setCatalog(data);
        setError("");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không tải được Effect Catalog");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog;
    return catalog.filter((effect) => `${effect.displayName} ${effect.key} ${effect.rarity} ${effect.capabilities.join(" ")}`.toLowerCase().includes(normalized));
  }, [catalog, query]);
  const selected = catalog.find((effect) => effect.key === selectedKey) ?? null;

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <div>
        <p className={styles.eyebrow}>PINORIA · BACK OFFICE</p>
        <h1>Effect Catalog</h1>
        <span>Code-defined mutations · read only</span>
      </div>
      <div className={styles.readOnlyBadge}>READ ONLY</div>
    </header>

    <section className={styles.toolbar}>
      <label className={styles.searchBox}>
        <span>⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search effect, key, capability…" />
      </label>
      <div className={styles.catalogMeta}><b>{catalog.length}</b><span>supported effects</span></div>
    </section>

    {error ? <div className={styles.error}>{error}</div> : null}
    <section className={styles.catalogPage} aria-busy={loading}>
      <div className={styles.listHead}><span>Effect</span><span>Rarity</span><span>Version</span><span>Capabilities</span><span>Surfaces</span></div>
      {loading ? <div className={styles.state}>Đang tải Effect Catalog…</div> : null}
      {!loading && !filtered.length ? <div className={styles.state}>Không có Effect phù hợp.</div> : null}
      <div className={styles.rows}>{filtered.map((effect) => <button key={effect.key} className={styles.row} onClick={() => setSelectedKey(effect.key)}>
        <span className={styles.itemCell}><i data-effect={effect.key}>{glyph(effect.key)}</i><span><b>{effect.displayName}</b><small>{effect.key}</small></span></span>
        <span><i className={styles.rarity} data-rarity={effect.rarity}>{effect.rarity}</i></span>
        <span>v{effect.implementationVersion}</span>
        <span className={styles.capabilityCell}>{effect.capabilities.slice(0, 3).map((capability) => <i key={capability}>{pretty(capability)}</i>)}</span>
        <span className={styles.surfaceCell}>{effect.capabilities.includes("FULL_AVATAR") ? "Full" : "—"}<b>·</b>{effect.capabilities.includes("HOUSE_MINI") ? "Mini" : "—"}</span>
      </button>)}</div>
    </section>

    {selected ? <div className={styles.backdrop} onClick={() => setSelectedKey(null)} /> : null}
    {selected ? <EffectSidePanel effect={selected} onClose={() => setSelectedKey(null)} /> : null}
  </main>;
}

function EffectSidePanel({ effect, onClose }: { effect: EffectDefinition; onClose: () => void }) {
  return <aside className={styles.peek} aria-label={`${effect.displayName} Effect detail`}>
    <div className={styles.peekTop}><button onClick={onClose} aria-label="Close Effect detail">✕</button><span>Effect catalog side peek</span><div>v{effect.implementationVersion}</div></div>
    <div className={styles.detailHead}>
      <div className={styles.detailGlyph} data-effect={effect.key}>{glyph(effect.key)}</div>
      <div><p>{effect.key}</p><h2>{effect.displayName}</h2><div className={styles.detailBadges}><i className={styles.rarity} data-rarity={effect.rarity}>{effect.rarity}</i><i>IMPLEMENTATION v{effect.implementationVersion}</i></div></div>
    </div>
    <div className={styles.peekBody}>
      <section className={styles.summary}><p>{effect.description}</p><div>{effect.capabilities.map((capability) => <span key={capability}>{pretty(capability)}</span>)}</div></section>
      <section className={styles.previewGrid}>
        <PreviewCard title="Full avatar" caption={effect.fullAvatarDescription}><FullAvatarPreview effectKey={effect.key} /></PreviewCard>
        <PreviewCard title="House mini" caption={effect.houseMiniDescription}><HouseMiniPreview effectKey={effect.key} /></PreviewCard>
      </section>
      <section className={styles.authorityNote}><span>AUTHORITY</span><strong>Behavior lives in code</strong><p>BO documents and previews this Effect. It does not edit shader, scale, locomotion, economy, RNG, PLS or Wish behavior.</p></section>
    </div>
  </aside>;
}

function PreviewCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return <article className={styles.previewCard}><header><span>{title}</span><i>LIVE CODE PREVIEW</i></header><div className={styles.previewStage}>{children}</div><p>{caption}</p></article>;
}

function FullAvatarPreview({ effectKey }: { effectKey: string }) {
  return <div className={styles.fullPreviewFrame}><LayeredCharacter className={styles.fullPreviewCharacter} config={PREVIEW_CHARACTER} effectKey={effectKey} effectSurface="FULL_AVATAR" /></div>;
}

function HouseMiniPreview({ effectKey }: { effectKey: string }) {
  const presentation = resolvePinoriaEffectPresentation(effectKey);
  const scale = presentation?.houseScale ?? 1;
  const speed = presentation?.speedMultiplier ?? 1;
  const duration = Math.min(8, Math.max(2.2, 4.8 / speed));
  const style = { "--mini-scale": scale, "--mini-duration": `${duration}s` } as CSSProperties;
  return <div className={styles.housePreview} data-effect={effectKey} data-preview-speed={speed}>
    <div className={styles.houseHorizon} />
    <div className={styles.miniTraveler} style={style}>
      <LayeredCharacter className={styles.miniCharacter} config={PREVIEW_CHARACTER} effectKey={effectKey} effectSurface="HOUSE_MINI" />
    </div>
  </div>;
}

function glyph(key: string) {
  if (key === "RAINBOW") return "◒";
  if (key === "GIANT") return "⬆";
  if (key === "TINY") return "⬇";
  if (key === "GHOST") return "◌";
  return "✦";
}

function pretty(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
