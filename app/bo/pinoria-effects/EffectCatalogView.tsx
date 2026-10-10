"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LayeredCharacter, type PinoriaCharacterConfig } from "@/app/pinoria-tv/layered-character";
import {
  BoDataGrid,
  BoDataGridBadge,
  BoDataGridCanonicalId,
  BoDataGridSidePeek,
  BoDataGridStatus,
  useBoDataGridUrlState,
  type BoDataGridColumn,
} from "@/app/bo/components/data-grid";
import {
  buildEffectCatalogGridRows,
  isEffectCatalogGridSortKey,
  prettyEffectCatalogToken,
  type EffectCatalogDefinition,
  type EffectCatalogGridRow,
} from "@/lib/bo-pinoria-effects-grid";
import { resolvePinoriaEffectPresentation } from "@/lib/pinoria-effect-presentation";
import styles from "./pinoria-effects.module.css";

type Envelope<T> = { data?: T; error?: { message?: string } };

const PREVIEW_CHARACTER: PinoriaCharacterConfig = {
  hair: "pinoria/char-base.png",
  face: "pinoria/char-base.png",
  outfit: "pinoria/char-base.png",
};

async function readCatalog(): Promise<EffectCatalogDefinition[]> {
  const response = await fetch("/api/bo/pinoria/effects/catalog", { cache: "no-store" });
  const json = await response.json() as Envelope<EffectCatalogDefinition[]>;
  if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Không tải được Effect Catalog");
  return json.data;
}

export function EffectCatalogView() {
  const [catalog, setCatalog] = useState<EffectCatalogDefinition[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { state, setSearch, setSort, setPage, setPageSize, setFilter } = useBoDataGridUrlState({ defaultPageSize: 25, allowedPageSizes: [10, 25, 50, 100] });
  const sortKey = isEffectCatalogGridSortKey(state.sortKey) ? state.sortKey : "effect";
  const rarityFilter = state.filters.rarity ?? "";

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

  const rows = useMemo(() => buildEffectCatalogGridRows(catalog, {
    search: state.search,
    rarity: rarityFilter,
    sortKey,
    sortDirection: state.sortDirection,
  }), [catalog, rarityFilter, sortKey, state.search, state.sortDirection]);
  const pageCount = Math.max(1, Math.ceil(rows.length / state.pageSize));
  const page = Math.min(state.page, pageCount);
  const pageRows = rows.slice((page - 1) * state.pageSize, page * state.pageSize);
  const selected = catalog.find((effect) => effect.key === selectedKey) ?? null;

  useEffect(() => {
    if (state.page > pageCount) setPage(pageCount);
  }, [pageCount, setPage, state.page]);

  const columns = useMemo<BoDataGridColumn<EffectCatalogGridRow>[]>(() => [
    {
      key: "effect",
      header: "Effect",
      sortable: true,
      sticky: true,
      minWidth: 230,
      render: (row) => <span className={styles.itemCell}><i data-effect={row.item.key}>{glyph(row.item.key)}</i><span><strong>{row.item.displayName}</strong><BoDataGridCanonicalId value={row.item.key} label={`Copy ${row.item.displayName} effect key`} /></span></span>,
    },
    { key: "rarity", header: "Rarity", sortable: true, minWidth: 120, render: (row) => <BoDataGridStatus value={row.item.rarity} tone={rarityTone(row.item.rarity)} /> },
    { key: "version", header: "Version", sortable: true, minWidth: 90, align: "right", render: (row) => `v${row.item.implementationVersion}` },
    { key: "capabilities", header: "Capabilities", sortable: true, minWidth: 280, render: (row) => <span className={styles.badgeList}>{row.item.capabilities.slice(0, 4).map((capability) => <BoDataGridBadge key={capability}>{prettyEffectCatalogToken(capability)}</BoDataGridBadge>)}</span> },
    { key: "surfaces", header: "Surfaces", sortable: true, minWidth: 180, render: (row) => <span className={styles.badgeList}>{surfaceBadges(row.item).map((surface) => <BoDataGridBadge key={surface}>{surface}</BoDataGridBadge>)}</span> },
  ], []);

  const filtered = Boolean(state.search || rarityFilter);
  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <div>
        <p className={styles.eyebrow}>PINORIA · BACK OFFICE</p>
        <h1>Effect Catalog</h1>
        <span>Code-defined mutations · read only</span>
      </div>
      <div className={styles.readOnlyBadge}>READ ONLY</div>
    </header>

    <div className={styles.gridWrap}>
      <BoDataGrid
        rows={pageRows}
        columns={columns}
        rowKey={(row) => row.item.key}
        caption="Pinoria Effect Catalog"
        state={loading ? "loading" : error ? "error" : "ready"}
        stateMessage={error || undefined}
        search={state.search}
        onSearchChange={setSearch}
        searchPlaceholder="Search effect, key, capability…"
        sortKey={sortKey}
        sortDirection={state.sortDirection}
        onSortChange={(key, direction) => { if (isEffectCatalogGridSortKey(key)) setSort(key, direction); }}
        filterChips={rarityFilter ? [{ key: "rarity", label: "Rarity", value: rarityFilter, onClear: () => setFilter("rarity", null) }] : []}
        toolbarActions={<label className={styles.gridToolbarFilter}>Rarity<select aria-label="Filter Effects by rarity" value={rarityFilter} onChange={(event) => setFilter("rarity", event.target.value || null)}><option value="">All</option><option value="COMMON">Common</option><option value="RARE">Rare</option><option value="EPIC">Epic</option><option value="LEGENDARY">Legendary</option></select></label>}
        resultLabel={`${rows.length} of ${catalog.length} effects`}
        pagination={{ page, pageSize: state.pageSize, total: rows.length, onPageChange: setPage, onPageSizeChange: setPageSize }}
        selectedRowKey={selectedKey}
        onRowOpen={(row) => setSelectedKey(row.item.key)}
        emptyTitle={filtered ? "No matching Effects" : "No Effects"}
        emptyMessage={filtered ? "Adjust search or rarity filter to see supported Effects." : "Core has not returned any code-defined Effects for this view."}
      />
    </div>

    {selected ? <EffectSidePanel effect={selected} onClose={() => setSelectedKey(null)} /> : null}
  </main>;
}

function EffectSidePanel({ effect, onClose }: { effect: EffectCatalogDefinition; onClose: () => void }) {
  return <BoDataGridSidePeek title={effect.displayName} eyebrow={`${effect.key} · implementation v${effect.implementationVersion}`} onClose={onClose}>
    <div className={styles.detailIdentity}>
      <div className={styles.detailGlyph} data-effect={effect.key}>{glyph(effect.key)}</div>
      <div className={styles.detailBadges}><BoDataGridStatus value={effect.rarity} tone={rarityTone(effect.rarity)} /><BoDataGridBadge>IMPLEMENTATION v{effect.implementationVersion}</BoDataGridBadge></div>
    </div>
    <section className={styles.summary}><p>{effect.description}</p><div className={styles.badgeList}>{effect.capabilities.map((capability) => <BoDataGridBadge key={capability}>{prettyEffectCatalogToken(capability)}</BoDataGridBadge>)}</div></section>
    <section className={styles.previewGrid}>
      <PreviewCard title="Full avatar" caption={effect.fullAvatarDescription}><FullAvatarPreview effectKey={effect.key} /></PreviewCard>
      <PreviewCard title="House mini" caption={effect.houseMiniDescription}><HouseMiniPreview effectKey={effect.key} /></PreviewCard>
    </section>
    <section className={styles.authorityNote}><span>AUTHORITY</span><strong>Behavior lives in code</strong><p>BO documents and previews this Effect. It does not edit shader, scale, locomotion, economy, RNG, PLS or Wish behavior.</p></section>
  </BoDataGridSidePeek>;
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

function surfaceBadges(effect: EffectCatalogDefinition) {
  return [effect.capabilities.includes("FULL_AVATAR") ? "Full avatar" : null, effect.capabilities.includes("HOUSE_MINI") ? "House mini" : null].filter((value): value is string => Boolean(value));
}

function rarityTone(rarity: EffectCatalogDefinition["rarity"]): "neutral" | "info" | "warning" | "danger" {
  if (rarity === "RARE") return "info";
  if (rarity === "EPIC") return "warning";
  if (rarity === "LEGENDARY") return "danger";
  return "neutral";
}

function glyph(key: string) {
  if (key === "RAINBOW") return "◒";
  if (key === "GIANT") return "⬆";
  if (key === "TINY") return "⬇";
  if (key === "GHOST") return "◌";
  return "✦";
}
