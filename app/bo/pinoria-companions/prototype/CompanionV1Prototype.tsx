"use client";

import { useEffect, useMemo, useState } from "react";
import {
  currentRequirement,
  normalizeLevels,
  normalizeRequirementQuantity,
  reconcileOwnedCompanionAfterLevelRemoval,
  resolveActiveGrantSpeciesId,
  setBringAlong,
  setManualLevel,
  setManualProgress,
  type CompanionOwner,
  type CompanionSpecies,
  type OwnedCompanion,
  type OwnerKind,
  type RequirementKind,
} from "../../../../lib/companion-v1-prototype-model";
import styles from "./companion-v1-prototype.module.css";

type GlobalItem = { id: string; name: string; key: string };
type Tab = "CATALOG" | "OWNERSHIP";

const GLOBAL_ITEMS: GlobalItem[] = [
  { id: "item-water-sigil", name: "Water Sigil", key: "pinoria.sigil.water" },
  { id: "item-earth-core", name: "Earth Core", key: "pinoria.relic.earth-core" },
  { id: "item-chroma-pearl", name: "Chroma Pearl", key: "pinoria.relic.chroma-pearl" },
];

const initialSpecies: CompanionSpecies[] = [
  {
    id: "species-mori",
    key: "mori-water",
    name: "Mori",
    status: "ACTIVE",
    metadata: '{"element":"water","temperament":"calm"}',
    levels: [
      { level: 1, label: "Sleeping", visualKind: "PNG", visualAssetKey: "pinoria/companion/mori/lv1-sleeping.png", metadata: '{"pose":"curl"}', requirementToNext: { kind: "FRUIT", quantity: 5 } },
      { level: 2, label: "Waking", visualKind: "WEBM", visualAssetKey: "pinoria/companion/mori/lv2-waking.webm", metadata: '{"loop":"idle"}', requirementToNext: { kind: "GLOBAL_ITEM", quantity: 1, globalItemId: "item-water-sigil" } },
      { level: 3, label: "Flowing", visualKind: "WEBM", visualAssetKey: "pinoria/companion/mori/lv3-flowing.webm", metadata: '{"loop":"hover"}', requirementToNext: { kind: "FRUIT", quantity: 8 } },
      { level: 4, label: "Awakened", visualKind: "WEBM", visualAssetKey: "pinoria/companion/mori/lv4-awakened.webm", metadata: '{"fx":"soft-aura"}', requirementToNext: null },
    ],
  },
  {
    id: "species-doro",
    key: "doro-earth",
    name: "Doro",
    status: "ACTIVE",
    metadata: '{"element":"earth","temperament":"bold"}',
    levels: [
      { level: 1, label: "Seedling", visualKind: "PNG", visualAssetKey: "pinoria/companion/doro/lv1-seedling.png", metadata: "{}", requirementToNext: { kind: "FRUIT", quantity: 4 } },
      { level: 2, label: "Rooted", visualKind: "WEBM", visualAssetKey: "pinoria/companion/doro/lv2-rooted.webm", metadata: "{}", requirementToNext: { kind: "GLOBAL_ITEM", quantity: 2, globalItemId: "item-earth-core" } },
      { level: 3, label: "Guardian", visualKind: "WEBM", visualAssetKey: "pinoria/companion/doro/lv3-guardian.webm", metadata: "{}", requirementToNext: null },
    ],
  },
  {
    id: "species-suna",
    key: "suna-earth",
    name: "Suna",
    status: "ACTIVE",
    metadata: '{"element":"earth","temperament":"curious"}',
    levels: [
      { level: 1, label: "Quiet", visualKind: "PNG", visualAssetKey: "pinoria/companion/suna/lv1-quiet.png", metadata: "{}", requirementToNext: { kind: "FRUIT", quantity: 3 } },
      { level: 2, label: "Roaming", visualKind: "WEBM", visualAssetKey: "pinoria/companion/suna/lv2-roaming.webm", metadata: "{}", requirementToNext: { kind: "FRUIT", quantity: 6 } },
      { level: 3, label: "Radiant", visualKind: "WEBM", visualAssetKey: "pinoria/companion/suna/lv3-radiant.webm", metadata: "{}", requirementToNext: null },
    ],
  },
];

const initialOwners: CompanionOwner[] = [
  {
    id: "student-anh-khoa",
    kind: "STUDENT",
    name: "Nguyễn Anh Khoa",
    subtitle: "Student · ACA Art · Center Cần Thơ",
    companions: [
      { id: "owned-khoa-mori", speciesId: "species-mori", currentLevel: 2, progressByLevel: { 1: 5, 2: 1 }, bringAlong: true },
      { id: "owned-khoa-doro", speciesId: "species-doro", currentLevel: 1, progressByLevel: { 1: 2 }, bringAlong: false },
    ],
  },
  {
    id: "student-minh-anh",
    kind: "STUDENT",
    name: "Trần Minh Anh",
    subtitle: "Student · Piano · Center Cần Thơ",
    companions: [
      { id: "owned-anh-suna", speciesId: "species-suna", currentLevel: 3, progressByLevel: { 1: 3, 2: 6 }, bringAlong: true },
    ],
  },
  {
    id: "staff-trang",
    kind: "STAFF",
    name: "Trang",
    subtitle: "Staff · Mentor · Center Cần Thơ",
    companions: [
      { id: "owned-trang-mori", speciesId: "species-mori", currentLevel: 3, progressByLevel: { 1: 5, 2: 1, 3: 11 }, bringAlong: true },
      { id: "owned-trang-suna", speciesId: "species-suna", currentLevel: 1, progressByLevel: { 1: 0 }, bringAlong: false },
    ],
  },
];

function requirementText(kind: RequirementKind, quantity: number, itemId?: string) {
  if (kind === "FRUIT") return `Fruit × ${quantity}`;
  const item = GLOBAL_ITEMS.find((entry) => entry.id === itemId);
  return `${item?.name ?? "Global item"} × ${quantity}`;
}

function mediaTone(index: number) {
  return [styles.mediaWater, styles.mediaEarth, styles.mediaViolet, styles.mediaGold][index % 4];
}

export function CompanionV1Prototype() {
  const [tab, setTab] = useState<Tab>("CATALOG");
  const [species, setSpecies] = useState(initialSpecies);
  const [owners, setOwners] = useState(initialOwners);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(initialSpecies[0].id);
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("STUDENT");
  const [selectedOwnerId, setSelectedOwnerId] = useState(initialOwners.find((owner) => owner.kind === "STUDENT")!.id);
  const [grantSpeciesId, setGrantSpeciesId] = useState(initialSpecies[1].id);
  const [notice, setNotice] = useState("Prototype state is local only · no gameplay gates");

  const selectedSpecies = species.find((entry) => entry.id === selectedSpeciesId) ?? species[0] ?? null;
  const activeSpecies = useMemo(() => species.filter((entry) => entry.status === "ACTIVE"), [species]);
  const filteredOwners = owners.filter((owner) => owner.kind === ownerKind);
  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId && owner.kind === ownerKind) ?? filteredOwners[0];

  const assignedSpeciesIds = useMemo(() => new Set(owners.flatMap((owner) => owner.companions.map((entry) => entry.speciesId))), [owners]);

  useEffect(() => {
    if (resolveActiveGrantSpeciesId(species, grantSpeciesId)) return;
    setGrantSpeciesId(activeSpecies[0]?.id ?? "");
  }, [activeSpecies, grantSpeciesId, species]);

  function patchSpecies(patch: Partial<CompanionSpecies>) {
    if (!selectedSpecies) return;
    setSpecies((current) => current.map((entry) => entry.id === selectedSpecies.id ? { ...entry, ...patch } : entry));
  }

  function patchLevel(level: number, patch: Partial<CompanionSpecies["levels"][number]>) {
    if (!selectedSpecies) return;
    patchSpecies({ levels: selectedSpecies.levels.map((entry) => entry.level === level ? { ...entry, ...patch } : entry) });
  }

  function addLevel() {
    if (!selectedSpecies) return;
    const next = selectedSpecies.levels.length + 1;
    const previous = selectedSpecies.levels.map((entry, index) => index === selectedSpecies.levels.length - 1
      ? { ...entry, requirementToNext: entry.requirementToNext ?? { kind: "FRUIT" as const, quantity: 1 } }
      : entry);
    patchSpecies({ levels: normalizeLevels([...previous, {
      level: next,
      label: `Level ${next}`,
      visualKind: "PNG",
      visualAssetKey: `pinoria/companion/${selectedSpecies.key}/lv${next}.png`,
      metadata: "{}",
      requirementToNext: null,
    }]) });
    setNotice(`Added Level ${next} to ${selectedSpecies.name}`);
  }

  function removeLevel(level: number) {
    if (!selectedSpecies || selectedSpecies.levels.length === 1) return;
    const remainingLevels = normalizeLevels(selectedSpecies.levels.filter((entry) => entry.level !== level));
    setSpecies((current) => current.map((entry) => entry.id === selectedSpecies.id ? { ...entry, levels: remainingLevels } : entry));
    setOwners((current) => current.map((owner) => ({
      ...owner,
      companions: owner.companions.map((companion) => reconcileOwnedCompanionAfterLevelRemoval(
        companion,
        selectedSpecies.id,
        level,
        remainingLevels.length,
      )),
    })));
    setNotice(`Removed Level ${level}; owned Companion level/progress state was reconciled to the resequenced stack`);
  }

  function createSpecies() {
    const id = `species-new-${Date.now()}`;
    const next: CompanionSpecies = {
      id,
      key: `new-companion-${species.length + 1}`,
      name: "New Companion",
      status: "ACTIVE",
      metadata: "{}",
      levels: [{ level: 1, label: "Level 1", visualKind: "PNG", visualAssetKey: "pinoria/companion/new/lv1.png", metadata: "{}", requirementToNext: null }],
    };
    setSpecies((current) => [...current, next]);
    setSelectedSpeciesId(id);
    setNotice("Created local Companion draft");
  }

  function deleteSpecies() {
    if (!selectedSpecies) return;
    if (assignedSpeciesIds.has(selectedSpecies.id)) {
      patchSpecies({ status: "ARCHIVED" });
      setNotice(`${selectedSpecies.name} is already owned, so prototype archived it instead of breaking ownership history`);
      return;
    }
    const remaining = species.filter((entry) => entry.id !== selectedSpecies.id);
    setSpecies(remaining);
    setSelectedSpeciesId(remaining[0]?.id ?? "");
    setNotice(`Deleted ${selectedSpecies.name}`);
  }

  function mutateOwnerCompanions(mutator: (companions: OwnedCompanion[]) => OwnedCompanion[]) {
    if (!selectedOwner) return;
    setOwners((current) => current.map((owner) => owner.id === selectedOwner.id ? { ...owner, companions: mutator(owner.companions) } : owner));
  }

  function switchOwnerKind(kind: OwnerKind) {
    setOwnerKind(kind);
    const first = owners.find((owner) => owner.kind === kind);
    if (first) setSelectedOwnerId(first.id);
  }

  function grantCompanion() {
    const activeGrantSpeciesId = resolveActiveGrantSpeciesId(species, grantSpeciesId);
    if (!selectedOwner || !activeGrantSpeciesId) {
      setNotice("Select an active Companion species before granting");
      return;
    }
    if (selectedOwner.companions.some((entry) => entry.speciesId === activeGrantSpeciesId)) {
      setNotice("Owner already has that Companion species");
      return;
    }
    const next: OwnedCompanion = {
      id: `owned-${selectedOwner.id}-${Date.now()}`,
      speciesId: activeGrantSpeciesId,
      currentLevel: 1,
      progressByLevel: { 1: 0 },
      bringAlong: selectedOwner.companions.length === 0,
    };
    mutateOwnerCompanions((current) => [...current, next]);
    setNotice(`Granted ${species.find((entry) => entry.id === activeGrantSpeciesId)?.name ?? "Companion"} to ${selectedOwner.name}`);
  }

  function revokeCompanion(companionId: string) {
    mutateOwnerCompanions((current) => current.filter((entry) => entry.id !== companionId));
    setNotice("Companion revoked locally");
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}>PINORIA · COMPANION FOUNDATION V1</div>
        <h1>Companion Control Center</h1>
        <p>Manual-first foundation for catalog, ownership, bring-along, level and progress. Rules are descriptive in V1 — operators remain in control.</p>
      </div>
      <div className={styles.heroBadges}>
        <span>PROTOTYPE</span><span>LOCAL STATE</span><span>NO GAMEPLAY GATES</span>
      </div>
    </header>

    <section className={styles.summaryStrip}>
      <div><span>Catalog</span><strong>{species.length}</strong><small>Companion species</small></div>
      <div><span>Configured levels</span><strong>{species.reduce((sum, entry) => sum + entry.levels.length, 0)}</strong><small>PNG / WEBM states</small></div>
      <div><span>Ownership</span><strong>{owners.reduce((sum, owner) => sum + owner.companions.length, 0)}</strong><small>Student + Staff</small></div>
      <div><span>Bring-along</span><strong>{owners.filter((owner) => owner.companions.some((entry) => entry.bringAlong)).length}</strong><small>Max one / owner</small></div>
    </section>

    <nav className={styles.tabs} aria-label="Companion prototype sections">
      <button className={tab === "CATALOG" ? styles.tabActive : ""} onClick={() => setTab("CATALOG")}><span>01</span> Catalog setup</button>
      <button className={tab === "OWNERSHIP" ? styles.tabActive : ""} onClick={() => setTab("OWNERSHIP")}><span>02</span> Ownership & manual control</button>
    </nav>

    <div className={styles.notice}><span>●</span>{notice}</div>

    {tab === "CATALOG" ? <section className={styles.catalogLayout}>
      <aside className={styles.sidebarCard}>
        <div className={styles.sidebarHeading}>
          <div><span>COMPANION CATALOG</span><strong>{species.length} species</strong></div>
          <button className={styles.iconButton} onClick={createSpecies}>+</button>
        </div>
        <div className={styles.speciesList}>
          {species.map((entry, index) => <button key={entry.id} className={`${styles.speciesRow} ${entry.id === selectedSpecies?.id ? styles.speciesRowActive : ""}`} onClick={() => setSelectedSpeciesId(entry.id)}>
            <span className={`${styles.speciesThumb} ${mediaTone(index)}`}>{entry.name.slice(0, 1)}</span>
            <span className={styles.speciesMeta}><strong>{entry.name}</strong><small>{entry.levels.length} levels · {entry.key}</small></span>
            <span className={entry.status === "ACTIVE" ? styles.statusActive : styles.statusArchived}>{entry.status}</span>
          </button>)}
        </div>
      </aside>

      {selectedSpecies ? <div className={styles.editorCard}>
        <div className={styles.editorHeader}>
          <div><span>CATALOG DETAIL</span><h2>{selectedSpecies.name}</h2><p>Configure identity, metadata, exact number of levels, visual per level and the descriptive requirement to the next level.</p></div>
          <div className={styles.headerActions}>
            <button className={styles.secondaryButton} onClick={() => { patchSpecies({ status: selectedSpecies.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }); setNotice("Lifecycle changed locally"); }}>{selectedSpecies.status === "ACTIVE" ? "Archive" : "Restore"}</button>
            <button className={styles.dangerButton} onClick={deleteSpecies}>Delete</button>
            <button className={styles.primaryButton} onClick={() => setNotice(`${selectedSpecies.name} catalog saved locally`)}>Save changes</button>
          </div>
        </div>

        <div className={styles.identityGrid}>
          <label><span>Display name</span><input value={selectedSpecies.name} onChange={(event) => patchSpecies({ name: event.target.value })} /></label>
          <label><span>Species key</span><input value={selectedSpecies.key} onChange={(event) => patchSpecies({ key: event.target.value })} /></label>
          <label className={styles.metadataField}><span>Metadata · JSON / structured payload</span><textarea rows={3} value={selectedSpecies.metadata} onChange={(event) => patchSpecies({ metadata: event.target.value })} /></label>
        </div>

        <div className={styles.sectionHeading}>
          <div><span>LEVEL STACK</span><h3>{selectedSpecies.levels.length} configured levels</h3><p>Requirement is definition data only in V1. It never auto-levels or blocks a manual operation.</p></div>
          <button className={styles.secondaryButton} onClick={addLevel}>+ Add level</button>
        </div>

        <div className={styles.levelStack}>
          {selectedSpecies.levels.map((level, index) => <article className={styles.levelCard} key={`${selectedSpecies.id}-${level.level}`}>
            <div className={`${styles.levelVisual} ${mediaTone(index)}`}>
              <div><span>LV {level.level}</span><strong>{level.label}</strong></div>
              <em>{level.visualKind}</em>
            </div>
            <div className={styles.levelBody}>
              <div className={styles.levelTopline}>
                <label><span>Level label</span><input value={level.label} onChange={(event) => patchLevel(level.level, { label: event.target.value })} /></label>
                <button className={styles.textDanger} disabled={selectedSpecies.levels.length === 1} onClick={() => removeLevel(level.level)}>Remove level</button>
              </div>
              <div className={styles.mediaEditor}>
                <label><span>Visual type</span><select value={level.visualKind} onChange={(event) => patchLevel(level.level, { visualKind: event.target.value as "PNG" | "WEBM" })}><option>PNG</option><option>WEBM</option></select></label>
                <label className={styles.assetField}><span>Asset key</span><input value={level.visualAssetKey} onChange={(event) => patchLevel(level.level, { visualAssetKey: event.target.value })} /></label>
                <button className={styles.mediaButton} onClick={() => setNotice(`Media picker placeholder for ${selectedSpecies.name} Lv${level.level}`)}>Choose media</button>
              </div>
              <label className={styles.inlineMetadata}><span>Level metadata</span><input value={level.metadata} onChange={(event) => patchLevel(level.level, { metadata: event.target.value })} /></label>
              {level.requirementToNext ? <div className={styles.requirementEditor}>
                <div className={styles.requirementTitle}><span>REQUIREMENT → LEVEL {level.level + 1}</span><small>Definition only · read-only when controlling owner progress</small></div>
                <label><span>Type</span><select value={level.requirementToNext.kind} onChange={(event) => {
                  const kind = event.target.value as RequirementKind;
                  patchLevel(level.level, { requirementToNext: { kind, quantity: level.requirementToNext?.quantity ?? 1, ...(kind === "GLOBAL_ITEM" ? { globalItemId: GLOBAL_ITEMS[0].id } : {}) } });
                }}><option value="FRUIT">Fruit</option><option value="GLOBAL_ITEM">Global catalog item</option></select></label>
                {level.requirementToNext.kind === "GLOBAL_ITEM" ? <label><span>Global item</span><select value={level.requirementToNext.globalItemId ?? GLOBAL_ITEMS[0].id} onChange={(event) => patchLevel(level.level, { requirementToNext: { ...level.requirementToNext!, globalItemId: event.target.value } })}>{GLOBAL_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.key}</option>)}</select></label> : null}
                <label className={styles.qtyField}><span>Quantity</span><input type="number" min={0} value={level.requirementToNext.quantity} onChange={(event) => patchLevel(level.level, { requirementToNext: { ...level.requirementToNext!, quantity: normalizeRequirementQuantity(Number(event.target.value)) } })} /></label>
              </div> : <div className={styles.finalLevel}><span>FINAL LEVEL</span><strong>No next-level requirement</strong></div>}
            </div>
          </article>)}
        </div>
      </div> : <div className={styles.editorCard}><div className={styles.emptyState}><strong>No Companion species</strong><span>Create a catalog entry to continue configuring levels and ownership.</span><button className={styles.primaryButton} onClick={createSpecies}>+ Create Companion</button></div></div>}
    </section> : null}

    {tab === "OWNERSHIP" ? <section className={styles.ownershipLayout}>
      <aside className={styles.sidebarCard}>
        <div className={styles.ownerToggle}>
          <button className={ownerKind === "STUDENT" ? styles.toggleActive : ""} onClick={() => switchOwnerKind("STUDENT")}>Students</button>
          <button className={ownerKind === "STAFF" ? styles.toggleActive : ""} onClick={() => switchOwnerKind("STAFF")}>Staff</button>
        </div>
        <div className={styles.ownerList}>
          {filteredOwners.map((owner) => <button key={owner.id} className={`${styles.ownerRow} ${owner.id === selectedOwner?.id ? styles.ownerRowActive : ""}`} onClick={() => setSelectedOwnerId(owner.id)}>
            <span className={styles.avatar}>{owner.name.split(" ").slice(-1)[0].slice(0, 1)}</span>
            <span><strong>{owner.name}</strong><small>{owner.companions.length} companions</small></span>
            {owner.companions.some((entry) => entry.bringAlong) ? <em>1 LIVE</em> : <em>NONE</em>}
          </button>)}
        </div>
      </aside>

      <div className={styles.ownerWorkspace}>
        <div className={styles.ownerHero}>
          <div className={styles.ownerIdentity}><span className={styles.avatarLarge}>{selectedOwner?.name.split(" ").slice(-1)[0].slice(0, 1)}</span><div><span>{selectedOwner?.kind}</span><h2>{selectedOwner?.name}</h2><p>{selectedOwner?.subtitle}</p></div></div>
          <div className={styles.grantBox}>
            <label><span>Grant companion</span><select value={grantSpeciesId} disabled={activeSpecies.length === 0} onChange={(event) => setGrantSpeciesId(event.target.value)}>{activeSpecies.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <button className={styles.primaryButton} disabled={activeSpecies.length === 0} onClick={grantCompanion}>+ Grant</button>
          </div>
        </div>

        <div className={styles.ruleBanner}>
          <strong>Manual control contract</strong>
          <span>Many owned Companions · maximum one bring-along · level can jump freely · progress can exceed requirement · no Fruit/item wallet consumption.</span>
        </div>

        <div className={styles.companionList}>
          {selectedOwner?.companions.length ? selectedOwner.companions.map((owned, index) => {
            const definition = species.find((entry) => entry.id === owned.speciesId);
            if (!definition) return null;
            const level = definition.levels.find((entry) => entry.level === owned.currentLevel) ?? definition.levels[0];
            const requirement = currentRequirement(owned, definition);
            const progress = owned.progressByLevel[owned.currentLevel] ?? 0;
            const denominator = requirement?.quantity ?? 0;
            const percent = denominator > 0 ? Math.min(100, Math.round((progress / denominator) * 100)) : 100;
            return <article className={`${styles.ownedCard} ${owned.bringAlong ? styles.ownedCardLive : ""}`} key={owned.id}>
              <div className={`${styles.ownedVisual} ${mediaTone(index)}`}><span>{definition.name.slice(0, 1)}</span><em>{level.visualKind}</em></div>
              <div className={styles.ownedMain}>
                <div className={styles.ownedHeading}><div><span>{definition.key}</span><h3>{definition.name}</h3></div>{owned.bringAlong ? <strong>BRINGING ALONG</strong> : <button onClick={() => { mutateOwnerCompanions((current) => setBringAlong(current, owned.id)); setNotice(`${definition.name} is now ${selectedOwner.name}'s bring-along Companion`); }}>Bring along</button>}</div>
                <div className={styles.manualGrid}>
                  <label><span>Manual level</span><select value={owned.currentLevel} onChange={(event) => mutateOwnerCompanions((current) => current.map((entry) => entry.id === owned.id ? setManualLevel(entry, Number(event.target.value), definition) : entry))}>{definition.levels.map((entry) => <option key={entry.level} value={entry.level}>Lv {entry.level} · {entry.label}</option>)}</select></label>
                  <div className={styles.readonlyRequirement}><span>Requirement · read only</span><strong>{requirement ? requirementText(requirement.kind, requirement.quantity, requirement.globalItemId) : "Final level"}</strong></div>
                  <label><span>Manual progress</span><div className={styles.progressInput}><input type="number" min={0} value={progress} disabled={!requirement} onChange={(event) => mutateOwnerCompanions((current) => current.map((entry) => entry.id === owned.id ? setManualProgress(entry, owned.currentLevel, Number(event.target.value)) : entry))} />{requirement ? <b>/ {requirement.quantity}</b> : <b>—</b>}</div></label>
                </div>
                <div className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
                <div className={styles.ownedFooter}><span>{level.label} · {level.visualAssetKey}</span><div>{owned.bringAlong ? <button className={styles.textButton} onClick={() => { mutateOwnerCompanions((current) => setBringAlong(current, null)); setNotice("Bring-along cleared"); }}>Stop bring-along</button> : null}<button className={styles.textDanger} onClick={() => revokeCompanion(owned.id)}>Revoke</button></div></div>
              </div>
            </article>;
          }) : <div className={styles.emptyState}><strong>No Companion yet</strong><span>Grant one from the catalog. First grant becomes bring-along automatically.</span></div>}
        </div>
      </div>
    </section> : null}
  </main>;
}
