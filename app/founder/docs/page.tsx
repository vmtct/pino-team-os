import Link from "next/link";
import type { ReactNode } from "react";
import { founderDocGroups, loadFounderDocuments, type FounderDocument, type FounderDocGroup } from "@/lib/founder-docs";
import styles from "./docs.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { doc?: string; group?: string; q?: string };

export default async function FounderDocsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  let loaded: Awaited<ReturnType<typeof loadFounderDocuments>>;
  try {
    loaded = await loadFounderDocuments();
  } catch (error) {
    return <SetupState message={error instanceof Error ? error.message : "Không thể đọc Founder Docs."} />;
  }

  const groups = founderDocGroups();
  const requestedGroup = groups.includes(params.group as FounderDocGroup) ? params.group as FounderDocGroup : "Features";
  const query = (params.q || "").trim().toLocaleLowerCase("vi");
  const groupDocs = loaded.documents.filter(doc => doc.group === requestedGroup);
  const visibleDocs = query ? groupDocs.filter(doc => `${doc.title} ${doc.relativePath} ${doc.specStatus} ${doc.implementationStatus || ""}`.toLocaleLowerCase("vi").includes(query)) : groupDocs;
  const selected = loaded.documents.find(doc => doc.relativePath === params.doc)
    || visibleDocs.find(doc => doc.relativePath === "features/current/open-studio.md")
    || visibleDocs[0]
    || groupDocs[0]
    || loaded.documents[0]
    || null;

  return <div className={styles.shell}>
    <header className={styles.topbar}>
      <div className={styles.titleBlock}><p className={styles.eyebrow}>PINO · FOUNDER OS</p><h1>Founder Docs</h1></div>
      <form className={styles.search} method="get" action="/founder/docs">
        <input type="hidden" name="group" value={requestedGroup} />
        <input name="q" defaultValue={params.q || ""} placeholder="Tìm tài liệu..." aria-label="Tìm tài liệu" />
        <button type="submit">Tìm</button>
      </form>
    </header>

    <section className={styles.workspace}>
      <aside className={styles.index}>
        <nav className={styles.tabs} aria-label="Nhóm tài liệu">
          {groups.map(group => <Link key={group} className={`${styles.tab} ${group === requestedGroup ? styles.tabActive : ""}`} href={`/founder/docs?group=${encodeURIComponent(group)}`}>{group}</Link>)}
        </nav>
        <div className={styles.listHeader}><strong>{requestedGroup}</strong><span>{visibleDocs.length} tài liệu</span></div>
        <div className={styles.docList}>
          {visibleDocs.length ? visibleDocs.map(doc => <DocLink key={doc.relativePath} doc={doc} active={selected?.relativePath === doc.relativePath} group={requestedGroup} query={params.q || ""} />) : <div className={styles.empty}>Không tìm thấy tài liệu phù hợp.</div>}
        </div>
      </aside>

      <article className={styles.reader}>
        {selected ? <>
          <header className={styles.readerHeader}>
            <h2>{selected.title}</h2>
            <div className={styles.chips}>
              <span className={styles.chip}><b>Spec</b> <StatusBadge value={selected.specStatus} /></span>
              {selected.implementationStatus ? <span className={styles.chip}><b>Implementation</b> <StatusBadge value={selected.implementationStatus} /></span> : null}
              <span className={styles.chip}><b>Canonical repo</b> {selected.canonicalRepo}</span>
              <span className={styles.chip}><b>Authority</b> {shortAuthority(selected.authority)}</span>
              {selected.surfaces.length ? <span className={styles.chip}><b>Surfaces</b> {selected.surfaces.join(", ")}</span> : null}
            </div>
          </header>
          <div className={styles.markdown}><Markdown source={selected.content} /></div>
        </> : <div className={styles.noSelection}><strong>Chưa có tài liệu</strong><p>Thêm Markdown vào `pino-core/docs` để tài liệu tự xuất hiện tại đây.</p></div>}
      </article>

      <aside className={styles.side}>
        {selected ? <div className={styles.sideCard}>
          <section className={styles.sideSection}><span className={styles.sideLabel}>Nguồn chuẩn</span><div className={styles.source}>{selected.sourcePath}</div><div className={styles.repoNote}>{selected.canonicalRepo} · local filesystem</div></section>
          <section className={styles.sideSection}><span className={styles.sideLabel}>Trạng thái</span><div className={styles.statusRow}><StatusBadge value={selected.specStatus} />{selected.implementationStatus ? <StatusBadge value={selected.implementationStatus} /> : null}</div><div className={styles.repoNote}>Cập nhật {formatDate(selected.updatedAt)}</div></section>
          <section className={styles.sideSection}><span className={styles.sideLabel}>Liên kết kiến trúc</span>{selected.relatedAdrs.length ? <ul className={styles.sideList}>{selected.relatedAdrs.map(adr => <li key={adr}>ADR {adr}</li>)}</ul> : <div className={styles.sideValue}>Chưa khai báo ADR liên quan.</div>}</section>
          <section className={styles.sideSection}><span className={styles.sideLabel}>Implementation</span>{selected.codeModules.length ? <ul className={styles.sideList}>{selected.codeModules.map(module => <li key={module}>{module}</li>)}</ul> : <div className={styles.sideValue}>Chưa khai báo module liên kết.</div>}</section>
          <section className={styles.sideSection}><span className={styles.sideLabel}>Local source</span><div className={styles.source}>{loaded.repoRoot}</div></section>
        </div> : null}
      </aside>
    </section>
  </div>;
}

function DocLink({ doc, active, group, query }: { doc: FounderDocument; active: boolean; group: FounderDocGroup; query: string }) {
  const href = `/founder/docs?group=${encodeURIComponent(group)}&doc=${encodeURIComponent(doc.relativePath)}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  return <Link href={href} className={`${styles.docItem} ${active ? styles.docItemActive : ""}`}>
    <span className={styles.docIcon}>{doc.group === "ADRs" ? "A" : doc.group === "Proposals" ? "P" : "D"}</span>
    <span><span className={styles.docTitle}><strong>{doc.title}</strong><StatusBadge value={doc.specStatus} /></span><span className={styles.docPath}>{doc.sourcePath}</span></span>
  </Link>;
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toUpperCase().replaceAll("_", " ");
  const className = normalized === "APPROVED" ? styles.approved
    : normalized === "PROPOSED" ? styles.proposed
    : normalized === "RECONSTRUCTED" ? styles.reconstructed
    : normalized === "IMPLEMENTED" ? styles.implemented
    : normalized === "PARTIAL" ? styles.partial
    : normalized === "NOT STARTED" ? styles.notstarted
    : styles.current;
  return <span className={`${styles.badge} ${className}`}>{normalized}</span>;
}

function SetupState({ message }: { message: string }) {
  return <section className={styles.setup}><p className={styles.eyebrow}>PINO · FOUNDER DOCS</p><h1>Kết nối local pino-core</h1><p>Founder Docs ở preview này đọc trực tiếp Markdown từ checkout local của `pino-core`; không copy tài liệu sang Team OS và không cần GitHub token.</p><ol><li>Đặt `pino-core` cạnh `pino-team-os`, hoặc</li><li>thêm đường dẫn tuyệt đối vào `.env.local`.</li></ol><pre>{`PINO_CORE_REPO_PATH=C:\\path\\to\\pino-core`}</pre><p><strong>Chi tiết:</strong> {message}</p></section>;
}

function Markdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) { index++; continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length; const content = inline(heading[2]);
      nodes.push(level === 1 ? <h1 key={index}>{content}</h1> : level === 2 ? <h2 key={index}>{content}</h2> : <h3 key={index}>{content}</h3>); index++; continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = []; const start = index++;
      while (index < lines.length && !lines[index]?.startsWith("```")) code.push(lines[index++] || "");
      index++; nodes.push(<pre key={start}><code>{code.join("\n")}</code></pre>); continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []; const start = index;
      while (index < lines.length && /^[-*]\s+/.test(lines[index] || "")) items.push((lines[index++] || "").replace(/^[-*]\s+/, ""));
      nodes.push(<ul key={start}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []; const start = index;
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] || "")) items.push((lines[index++] || "").replace(/^\d+\.\s+/, ""));
      nodes.push(<ol key={start}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>); continue;
    }
    const paragraph: string[] = []; const start = index;
    while (index < lines.length && (lines[index] || "").trim() && !/^(#{1,3})\s+/.test(lines[index] || "") && !/^[-*]\s+/.test(lines[index] || "") && !/^\d+\.\s+/.test(lines[index] || "") && !(lines[index] || "").startsWith("```")) paragraph.push((lines[index++] || "").trim());
    nodes.push(<p key={start}>{inline(paragraph.join(" "))}</p>);
  }
  return <>{nodes}</>;
}

function inline(value: string): ReactNode[] {
  const pieces = value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return pieces.map((piece, index) => piece.startsWith("`") && piece.endsWith("`") ? <code key={index}>{piece.slice(1, -1)}</code> : piece.startsWith("**") && piece.endsWith("**") ? <strong key={index}>{piece.slice(2, -2)}</strong> : piece);
}

function shortAuthority(value: string): string { return value.length > 44 ? `${value.slice(0, 41)}…` : value; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
