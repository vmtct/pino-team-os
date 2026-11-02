"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import { latestStudentSubscription } from "@/lib/bo-student-latest-subscription";
import type { BoRecord } from "@/lib/bo-registration";
import { BoValue } from "./BoValue";
import { subscriptionModule } from "./BoStudentSubscriptionRelation";

type Load =
  | { state: "loading" }
  | { state: "ready"; subscription: BoRecord | null }
  | { state: "error"; message: string };

/** BO-only, read-only extension of the existing Student Quick View Drawer. */
export function BoStudentLatestSubscription({ studentId }: { studentId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    void boApi.learnerLifecycle(studentId).then(lifecycle => {
      if (current) setLoad({ state: "ready", subscription: latestStudentSubscription(lifecycle, studentId) });
    }).catch((error: unknown) => {
      if (current) setLoad({
        state: "error",
        message: error instanceof Error ? error.message : "Không thể tải Subscription.",
      });
    });
    return () => { current = false; };
  }, [studentId, retry]);

  const properties = [
    ["path", "Path"],
    ["status", "Trạng thái"],
    ["start", "Ngày bắt đầu"],
    ["end", "Ngày kết thúc"],
    ["weekly", "Buổi / tuần"],
    ["remaining", "Buổi còn lại"],
    ["id", "Subscription ID"],
  ] as const;

  return <section className="property-section" aria-label="Subscription mới nhất" data-student-latest-subscription>
    <h3>Subscription mới nhất</h3>
    {load.state === "loading"
      ? <p role="status" className="settings-hint">Đang tải Subscription…</p>
      : load.state === "error"
      ? <div className="edit-error" role="alert">
          {load.message} <button type="button" onClick={() => { setLoad({ state: "loading" }); setRetry(n => n + 1); }}>Thử lại</button>
        </div>
      : load.subscription === null
      ? <p role="status" className="settings-hint">Học viên chưa có Subscription.</p>
      : properties.map(([key, label]) => {
        const field = subscriptionModule.fields.find(f => f.key === key);
        if (!field) return null;
        return <div className="property-row" key={key}>
          <div className="property-label"><small>{field.icon}</small>{label}</div>
          <div className="property-control" aria-label={label}>
            <BoValue field={field} value={load.subscription![key]} />
          </div>
        </div>;
      })}
  </section>;
}
