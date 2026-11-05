"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DrawerFrame } from "@pino/design-system/react";
import type { ModuleRow } from "@/lib/workspace-schema";
import { selfFields, type SelfFields } from "./schema";
import { SelfDirectoryProperties } from "./SharedProperties";
import styles from "./SelfWardrobeDetail.module.css";
/** PAP-1300 / PAP-1490: DS cards with the approved feature-owned responsive grid. */

type Row = ModuleRow<SelfFields>;
type ItemType = "WEARABLE" | "ACCESSORY";
type Ownership = { status: string; revision: number; provenance: string; firstGrantedAt: string; revokedAt: string | null; updatedAt: string };
type OwnedItem = { itemId: string; key: string; displayName: string; type: ItemType; slot: string | null; itemStatus: string; ownership: Ownership };
type CatalogItem = { itemId: string; key: string; displayName: string; type: ItemType; slot: string | null; owned: boolean; ownershipStatus: string | null };
type Collection<T> = { selfId: string; selfVersion: number; items: T[] };
type Command = { item: OwnedItem | CatalogItem; mode: "grant" | "revoke" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkedCollection<T>(value: unknown, selfId: string): Collection<T> {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const raw = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
  if (raw.selfId !== selfId || !Number.isSafeInteger(raw.selfVersion) || Number(raw.selfVersion) < 1 ||
    !Array.isArray(raw.items) || raw.items.some(item => !item || typeof item !== "object" ||
      !UUID.test(String(item.itemId)) || typeof item.displayName !== "string" ||
      !["WEARABLE", "ACCESSORY"].includes(item.type))) throw Error("Core trả về danh sách Item không hợp lệ.");
  return raw as Collection<T>;
}
async function getCollection<T>(selfId: string, centerId: string, kind: "items" | "catalog", signal: AbortSignal): Promise<Collection<T>> {
  const response = await fetch("/api/bo/pinoria/selfs/" + selfId + "/" + kind + "?centerId=" + encodeURIComponent(centerId), { signal, credentials: "include", cache: "no-store" });
  if (!response.ok) throw Error(response.status === 403 ? "Không có quyền xem Item của Self tại cơ sở này." : "Không tải được " + kind + " từ Core (" + response.status + ").");
  return checkedCollection<T>(await response.json(), selfId);
}
export function SelfWardrobeDetail({ row, centerId, activeTab, canView, canManage, onSaved }: {
  row: Row; centerId: string; activeTab: string; canView: boolean; canManage: boolean; onSaved: () => void;
}) {
  const selfId = typeof row.pinoriaSelfId === "string" && UUID.test(row.pinoriaSelfId) ? row.pinoriaSelfId : null;
  const [owned, setOwned] = useState<Collection<OwnedItem> | null>(null);
  const [catalog, setCatalog] = useState<Collection<CatalogItem> | null>(null);
  const [collection, setCollection] = useState<"owned" | "catalog">("owned");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | ItemType>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [command, setCommand] = useState<Command | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (activeTab !== "wardrobe" || !selfId || !canView) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(""); } });
    void Promise.all([
      getCollection<OwnedItem>(selfId, centerId, "items", controller.signal),
      getCollection<CatalogItem>(selfId, centerId, "catalog", controller.signal),
    ]).then(([a, b]) => {
      if (controller.signal.aborted) return;
      if (a.selfVersion !== b.selfVersion) { setError("Dữ liệu sở hữu đang thay đổi. Hãy tải lại."); return; }
      setOwned(a); setCatalog(b);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Lỗi Core."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeTab, selfId, centerId, canView, revision]);
  const shown = useMemo(() => {
    const source = collection === "owned" ? (owned?.items ?? []).filter(item => item.ownership.status === "ACTIVE") : (catalog?.items ?? []);
    return source.filter(item => (type === "ALL" || item.type === type) && (item.displayName + " " + item.key).toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  }, [collection, owned, catalog, type, search]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!command || !selfId || !catalog || !canManage || saving || !reason.trim()) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const url = "/api/bo/pinoria/selfs/" + selfId + "/items/" + command.item.itemId + "/" + command.mode + "?centerId=" + encodeURIComponent(centerId);
      const response = await fetch(url, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ expectedSelfVersion: catalog.selfVersion, reason: reason.trim() }),
      });
      if (!response.ok) {
        if (response.status === 409) throw Error("Dữ liệu đã thay đổi hoặc Item không thể thu hồi. Hãy kiểm tra và thử lại.");
        if (response.status === 403) throw Error("Không có quyền thực hiện thao tác ở cơ sở này.");
        throw Error("Core từ chối thao tác (" + response.status + ").");
      }
      setCommand(null); setReason("");
      setNotice(command.mode === "grant" ? "Đã cấp Item; Grant không tự Equip." : "Đã thu hồi Item.");
      setRevision(v => v + 1); onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể thực hiện thao tác.");
      setRevision(v => v + 1);
    } finally { setSaving(false); }
  }
  if (activeTab === "overview") return <SelfDirectoryProperties
    record={{ ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])), id: row.id, name: String(row.name ?? "") }}
    fields={selfFields.filter(field => Object.hasOwn(row, field.key)).map(field => ({
      key: field.key, label: field.label, icon: field.icon, type: field.type,
      w: field.width, readonly: true,
    }))}
    sections={[
      { id: "identity", label: "Định danh", fields: ["name", "roles", "subjectStatus", "rowKey", "personId", "staffMemberId", "studentProfileId"] },
      { id: "self", label: "Pinoria Self", fields: ["avatarStatus", "pinoriaSelfId", "selfStatus", "loadoutVersion", "equippedCount"] },
    ]}/>;
  if (activeTab !== "wardrobe") return null;
  if (!selfId) return <p role="status">Person này chưa có Pinoria Self; không thể quản lý Tủ đồ.</p>;
  if (!canView) return <p role="alert">Bạn chưa được cấp quyền xem Item của Self.</p>;
  return <section className="grid-card" aria-label="Tủ đồ của Self">
    <div className="view-tabs" role="group" aria-label="Bộ sưu tập Item">
      <button type="button" aria-pressed={collection === "owned"} className="view-tab" onClick={() => setCollection("owned")}>Đã sở hữu ({owned?.items.filter(item => item.ownership.status === "ACTIVE").length ?? 0})</button>
      <button type="button" aria-pressed={collection === "catalog"} className="view-tab" onClick={() => setCollection("catalog")}>Thư Viện Đồ Pinoria</button>
    </div>
    <div className="toolbar">
      <input aria-label="Tìm Item" placeholder="Tìm Item..." value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Lọc loại Item" value={type} onChange={event => setType(event.target.value as typeof type)}>
        <option value="ALL">Tất cả loại</option><option value="WEARABLE">Wearable</option><option value="ACCESSORY">Accessory</option>
      </select>
    </div>
    {Number(row.equippedCount) > 0 && <p className="datatag gold" role="note">Self đang có trang bị. Nếu Item đang được trang bị, Core sẽ tháo khỏi slot và thu hồi trong một giao dịch.</p>}
    {loading && <p role="status">Đang tải Item từ Core…</p>}
    {error && <p role="alert" className="error">{error} <button type="button" onClick={() => setRevision(v => v + 1)}>Tải lại</button></p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && <div className={styles.items}>
      {shown.length ? shown.map(item => {
        const isOwned = collection === "owned" || ("owned" in item && item.owned);
        const grantAllowed = !isOwned && canManage;
        const revokeAllowed = isOwned && canManage && collection === "owned";
        const active = collection === "owned" ? item as OwnedItem : null;
        return <article className="grid-card" key={item.itemId}>
          <span className="datatag blue" aria-hidden="true">✦</span>
          <div className="property-control"><strong>{item.displayName}</strong>
            <small>{item.slot ?? item.type} · {item.type}</small>
            {active && <small>Nguồn: {active.ownership.provenance} · Cấp: {active.ownership.firstGrantedAt}</small>}
          </div>
          <div className="toolbar">
            {grantAllowed && <button type="button" className="secondary-btn" onClick={() => { setCommand({ item, mode: "grant" }); setReason(""); }}>Cấp Item</button>}
            {revokeAllowed && <button type="button" className="secondary-btn" onClick={() => { setCommand({ item, mode: "revoke" }); setReason(""); }}>Thu hồi</button>}
            {isOwned && !revokeAllowed && <span className="datatag green">Đã sở hữu</span>}
          </div>
        </article>;
      }) : <p role="status">Chưa có Item phù hợp.</p>}
    </div>}
    {command && <DrawerFrame title={command.mode === "grant" ? "Cấp Item" : "Thu hồi Item"} path="Pinoria Self · Tủ đồ" open onClose={() => setCommand(null)}>
      <form id="self-item-confirm-form" onSubmit={event => { void submit(event); }} className="grid-card">
        <h3>{command.mode === "grant" ? "Cấp Item" : "Thu hồi Item"}</h3>
        <p>{command.item.displayName}</p>
        {command.mode === "revoke" && <p className="datatag gold">Nếu Item đang trang bị, Core sẽ tháo trang bị và thu hồi đồng thời; trạng thái READY có thể thay đổi.</p>}
        <label htmlFor="self-item-reason">Lý do *</label>
        <textarea id="self-item-reason" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} autoFocus />
        <div className="toolbar">
          <button type="button" className="secondary-btn" disabled={saving} onClick={() => setCommand(null)}>Hủy</button>
          <button type="submit" className="primary-btn" disabled={saving || !reason.trim()}>{saving ? "Đang lưu…" : "Xác nhận"}</button>
        </div>
      </form>
    </DrawerFrame>}
  </section>;
}
