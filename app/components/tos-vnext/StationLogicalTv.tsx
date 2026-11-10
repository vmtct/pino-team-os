"use client";
/** PAP-1753 / PAP-1758 · Epic PAP-650 PNR-TV.
 * Only a logical TV listing; no display lookup, pairing, device command or Viewer ACL.
 * Current backend has no shared logical-TV projection: callers pass [] and stay fail-closed.
 */
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldHalved, faTv } from "@fortawesome/free-solid-svg-icons";
import {
  visibleLogicalTvs, type LogicalTvListItem,
} from "@/lib/pnr-tv-logical-visibility";
import styles from "./StationLogicalTv.module.css";

export function StationLogicalTv({tvs=[],centerId,centerName,authorizedCenterIds}:{
  tvs?: readonly LogicalTvListItem[];
  centerId: string | null;
  centerName: string;
  authorizedCenterIds: readonly string[];
}){
  const authorized=Boolean(centerId && authorizedCenterIds.includes(centerId));
  const rows=visibleLogicalTvs(tvs,centerId,authorizedCenterIds);
  return <div data-pnr-tv-model="logical" data-pnr-tv-source={tvs.length?"projection":"awaiting-core"} className={styles.layout}>
    <section className={styles.panel}>
      <div className={styles.heading}><h3>TV tại Center</h3><span>Danh sách TV logic</span></div>
      {!authorized?<div className={styles.empty} role="status">
        Chưa xác minh Center được cấp quyền. Không hiển thị TV.
      </div>:rows.length===0?<div className={styles.empty} role="status">
        <strong>Chưa có TV khả dụng tại Center này</strong>
        <span>Danh sách TV logic từ Core chưa được cung cấp hoặc Center chưa được gán TV.</span>
      </div>:<div className={styles.list}>{rows.map(row=><article key={row.tvId}
        className={styles.card} data-pnr-tv-logical-id={row.tvId}>
        <span className={styles.icon} aria-hidden="true"><FontAwesomeIcon icon={faTv}/></span>
        <div className={styles.copy}><strong>{row.name}</strong><span>{centerName} · TV dùng chung nhiều Center</span></div>
        <button type="button" className={styles.viewer} disabled title="Viewer cần Core xác thực"
          aria-label={"Mở TV "+row.name}>Mở TV</button>
      </article>)}</div>}
    </section>
    <aside className={styles.note} role="status"><strong><FontAwesomeIcon icon={faShieldHalved}/> Quyền xem</strong>
      <p>Lọc theo Center chỉ áp dụng cho danh sách. Viewer chưa khả dụng cho đến khi Core xác thực
        tài khoản TOS, Center và quyền xem Policy đã xuất bản. Không cần ghép TV vật lý.</p>
    </aside>
  </div>;
}
