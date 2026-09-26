"use client";

import { FormEvent, useEffect, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoWorkforceShiftTemplate } from "@/lib/bo-model";
import styles from "../bo.module.css";

type Props = {
  centerId: string;
  onChanged: () => Promise<void>;
};

export function ShiftTemplateManager({ centerId, onChanged }: Props) {
  const [templates, setTemplates] = useState<BoWorkforceShiftTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ code: "", displayLabel: "", startLocalTime: "14:00", endLocalTime: "21:00" });

  useEffect(() => {
    if (!centerId) {
      setTemplates([]);
      return;
    }
    void load(centerId);
  }, [centerId]);

  async function load(targetCenterId = centerId) {
    if (!targetCenterId) return;
    setLoading(true);
    try {
      setTemplates(await boApi.workforceShiftTemplates(targetCenterId));
    } catch (error) {
      setNotice(message(error));
    } finally {
      setLoading(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!centerId || !draft.code.trim() || !draft.displayLabel.trim()) return;
    setBusy("create");
    setNotice("");
    try {
      const created = await boApi.createWorkforceShiftTemplate({
        centerId,
        code: draft.code.trim(),
        displayLabel: draft.displayLabel.trim(),
        startLocalTime: draft.startLocalTime,
        endLocalTime: draft.endLocalTime,
      }, crypto.randomUUID());
      setDraft((current) => ({ ...current, code: "", displayLabel: "" }));
      setNotice(`${created.displayLabel} đã ACTIVE và sẵn sàng cho planning.`);
      await Promise.all([load(), onChanged()]);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy("");
    }
  }

  async function setStatus(template: BoWorkforceShiftTemplate) {
    if (!centerId) return;
    const nextStatus = template.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setBusy(template.id);
    setNotice("");
    try {
      await boApi.setWorkforceShiftTemplateStatus(template.id, centerId, nextStatus, crypto.randomUUID());
      setNotice(nextStatus === "ACTIVE"
        ? `${template.displayLabel} đã ACTIVE trở lại.`
        : `${template.displayLabel} đã INACTIVE; lịch sử assignment/timekeeping vẫn được giữ.`);
      await Promise.all([load(), onChanged()]);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy("");
    }
  }

  return <section className={styles.panel}>
    <div className={styles.panelHeading}>
      <div>
        <h2>Shift Templates</h2>
        <p>Tạo ca chuẩn của Center và quản lý trạng thái dùng cho planning mới.</p>
      </div>
      <span className={styles.writePill}>{templates.filter((item) => item.status === "ACTIVE").length} ACTIVE</span>
    </div>

    <form className={styles.shiftTemplateForm} onSubmit={(event) => void create(event)}>
      <label className={styles.field}>Code
        <input value={draft.code} maxLength={64} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="EVENING" />
      </label>
      <label className={styles.field}>Tên ca
        <input value={draft.displayLabel} maxLength={160} onChange={(event) => setDraft({ ...draft, displayLabel: event.target.value })} placeholder="Ca tối" />
      </label>
      <label className={styles.field}>Bắt đầu
        <input type="time" value={draft.startLocalTime} onChange={(event) => setDraft({ ...draft, startLocalTime: event.target.value })} />
      </label>
      <label className={styles.field}>Kết thúc
        <input type="time" value={draft.endLocalTime} onChange={(event) => setDraft({ ...draft, endLocalTime: event.target.value })} />
      </label>
      <button className={styles.primaryButton} disabled={!centerId || !draft.code.trim() || !draft.displayLabel.trim() || !!busy}>
        {busy === "create" ? "Đang tạo…" : "Tạo ShiftTemplate"}
      </button>
    </form>

    {notice ? <p className={styles.shiftTemplateNotice}>{notice}</p> : null}
    {loading ? <div className={styles.empty}>Đang tải ShiftTemplates…</div> : null}
    {!loading && !templates.length ? <div className={styles.empty}>Center chưa có ShiftTemplate. Tạo ca đầu tiên để mở planning.</div> : null}
    {!loading && templates.length ? <div className={styles.shiftTemplateList}>
      {templates.map((template) => <article className={styles.shiftTemplateRow} key={template.id}>
        <div>
          <strong>{template.displayLabel}</strong>
          <span>{template.code} · {template.startLocalTime}–{template.endLocalTime}</span>
        </div>
        <div className={styles.subscriptionActions}>
          <span className={styles.statusPill}>{template.status}</span>
          <button
            type="button"
            className={template.status === "ACTIVE" ? styles.secondaryButton : styles.primaryButton}
            disabled={!!busy}
            onClick={() => void setStatus(template)}
          >
            {busy === template.id ? "…" : template.status === "ACTIVE" ? "Inactivate" : "Activate"}
          </button>
        </div>
      </article>)}
    </div> : null}
    <p className={styles.shiftTemplateHint}>INACTIVE chỉ chặn planning/assignment mới; historical Assignment và Timekeeping không bị rewrite.</p>
  </section>;
}

function message(error: unknown) {
  if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`;
  return error instanceof Error ? error.message : "ShiftTemplate command failed.";
}
