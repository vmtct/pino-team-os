"use client";
/** PAP-2030 / PNR-WISH — reuse native BoQuickView. Unmounted until authorization. */
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import type {PolicyValue,WishConfigHead} from "@/lib/pls-wish-ho-contract";
import {policyView,wishPolicyModule} from "./wish-policy-view";
type Props={head:WishConfigHead<PolicyValue>;selection:"published"|"pending";centerLabel:string|null;onClose:()=>void;onDetail?:()=>void};
export function HoWishPolicyViewDrawer({head,selection,centerLabel,onClose,onDetail}:Props){
 const view=policyView(head,selection,centerLabel);
 return <BoQuickView module={wishPolicyModule} legacyStyles record={view.row} onClose={onClose} onDetail={onDetail} hideDetailAction={!onDetail}
 extraSection={<section aria-label="Soft pity curve">
 <h3>Soft pity curve</h3>
 <table><thead><tr><th scope="col">Wish</th><th scope="col">5★ (%)</th></tr></thead><tbody>{view.curve.map(step=><tr key={step.position}><td>{step.position}</td><td>{step.percentage}</td></tr>)}</tbody></table>
 {!head.audit&&<p className="settings-hint">Thông tin audit chưa có từ Core.</p>}
 <p className="settings-hint">Media là tham chiếu cấu hình; chưa xác nhận khả năng phát.</p>
 <p className="settings-hint">Thời điểm tạo phiên bản: <time dateTime={view.revisionCreatedAt}>{view.revisionCreatedAt}</time></p>
 </section>}/>;
}
