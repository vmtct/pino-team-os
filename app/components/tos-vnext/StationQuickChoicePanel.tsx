"use client";
// PAP-655 · Quick Choice, PAP-650 · Pinoria TV. Presentation candidate only.
// Host can mount only with a supplied, Center-scoped Core adapter; absent by default.
import {
  visibleStationChoiceTurns,stationChoiceAction,
  type StationChoiceAction,type StationChoiceRead,
} from "@/lib/pnr-tv-station-choice-presentation";
import Image from "next/image";
import ops from "./ops.module.css";
import css from "./StationQuickChoicePanel.module.css";

export type StationQuickChoiceBinding={
  read:StationChoiceRead;
  pendingVisitIds:readonly string[];
  errorsByVisit?:Readonly<Record<string,string>>;
  onAction:(action:StationChoiceAction)=>void;
};
export function StationQuickChoicePanel({read,selectedCenterId,pendingVisitIds,errorsByVisit={},onAction}:StationQuickChoiceBinding & {selectedCenterId:string|null}){
  const turns=visibleStationChoiceTurns(read,selectedCenterId);
  if(!selectedCenterId||read.centerId!==selectedCenterId||read.status==="unverified")return null;
  if(read.status==="loading"||read.status==="error")return <section className={ops.panel} aria-label="Quick Choice">
    <div className={ops.panelTitle}><h3>Quick Choice</h3></div>
    <p className={css.message} role={read.status==="error"?"alert":"status"}>
      {read.status==="error"?"Không thể tải Quick Choice. Vui lòng thử lại.":"Đang tải Quick Choice…"}
    </p>
  </section>;
  if(!turns.length)return null;
  return <section className={ops.panel} data-quick-choice="station" aria-label="Quick Choice">
    <div className={ops.panelTitle}><h3>Quick Choice</h3><span>{turns.length} lượt</span></div>
    <div className={css.turns}>{turns.map(turn=>{
      const pending=pendingVisitIds.includes(turn.visitId),error=errorsByVisit[turn.visitId];
      return <article key={turn.visitId} className={css.turn} data-turn={turn.visitId} aria-busy={pending}>
        <div className={css.heading}><strong>{turn.learnerName}</strong><span>{turn.balancePls.toLocaleString("vi-VN")} PLS</span></div>
        <p className={css.message}>{turn.offers.length ? "Xác nhận lựa chọn của học viên trước khi chọn." : "Hiện không có sản phẩm phù hợp. Chọn Bỏ qua để tiếp tục."}</p>
        {turn.offers.length > 0 && <div className={css.options}>{turn.offers.map(offer=>
          <button type="button" key={offer.offerId} className={ops.option+" "+css.option}
            disabled={pending||offer.pricePls>turn.balancePls}
            aria-label={offer.displayName+" · "+offer.pricePls+" PLS"}
            onClick={()=>{const action=stationChoiceAction(turn,offer.offerId);if(action&&!pending)onAction(action);}}>
            {offer.imageUrl&&<Image className={css.artwork} src={offer.imageUrl} width={48} height={48} alt="" unoptimized/>}
            <span className={css.copy}><strong>{offer.displayName}</strong><small>{offer.pricePls.toLocaleString("vi-VN")} PLS</small></span>
            {offer.pricePls>turn.balancePls&&<small>Không đủ PLS</small>}
          </button>)}</div>}
        <button type="button" disabled={pending} className={ops.secondary+" "+css.skip}
          onClick={()=>{const action=stationChoiceAction(turn,null);if(action&&!pending)onAction(action);}}>Bỏ qua</button>
        {pending&&<p role="status" className={css.message}>Đang xác nhận từ hệ thống…</p>}
        {error&&<p role="alert" className={css.message}>{error}</p>}
      </article>;
    })}</div>
  </section>;
}
