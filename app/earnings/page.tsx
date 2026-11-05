"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {TosShell} from "@/app/components/tos-shell";
import {TOS_SHIFT_FOOTER} from "@/app/components/tos-shell/navigation";
import {workforceApi,type WorkforceContext} from "@/lib/workforce-api";
import {ownIncome,type OwnIncomePeriod} from "@/lib/tos-own-income-api";
import styles from "./earnings.module.css";

type Center=WorkforceContext["centers"][number];
const money=(minor:number|null)=>minor===null?"Chưa khả dụng":
  new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(minor/100);
const date=(s:string)=>s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4);
const label=(row:OwnIncomePeriod)=>row.status==="PAID"?"Đã thanh toán":
  row.status==="FINALIZED"?"Đã chốt":row.status==="DRAFT"?"Chưa chốt":"Không khả dụng";

export default function EarningsPage(){
  const [centers,setCenters]=useState<Center[]>([]);
  const [centerId,setCenterId]=useState("");
  const [periods,setPeriods]=useState<OwnIncomePeriod[]>([]);
  const [nextOffset,setNextOffset]=useState<number|null>(null);
  const [loading,setLoading]=useState(true);
  const [more,setMore]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void workforceApi.context().then(({data})=>{
      if(!active)return;
      setCenters(data.centers);
      setCenterId(data.centers[0]?.id??"");
      if(!data.centers.length){setError("Chưa có cơ sở được phân quyền.");setLoading(false);}
    }).catch((e:unknown)=>{if(active){setError(e instanceof Error?e.message:"Không thể tải cơ sở.");setLoading(false);}});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!centerId)return;
    let active=true;
    setLoading(true);setError("");setPeriods([]);setNextOffset(null);
    void ownIncome(centerId).then(result=>{
      if(active){setPeriods(result.data);setNextOffset(result.nextOffset);}
    }).catch((e:unknown)=>{
      if(active)setError(e instanceof Error?e.message:"Không thể tải thu nhập.");
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[centerId]);
  async function loadMore(){
    if(!centerId||nextOffset===null||more)return;
    setMore(true);setError("");
    try{
      const result=await ownIncome(centerId,20,nextOffset);
      setPeriods(current=>[...current,...result.data]);
      setNextOffset(result.nextOffset);
    }catch(e){setError(e instanceof Error?e.message:"Không thể tải thêm.");}
    finally{setMore(false);}
  }
  const current=periods[0];
  return <TosShell title="Ca làm" theme="shift" footerItems={TOS_SHIFT_FOOTER}
    activeFooterId="income" compactAppHeader backHref="/"
    appIconSrc="https://pub-892fa79b018d4d2f9b0808189dd2ce46.r2.dev/AppIcon/shift.png">
    <div className={styles.stack}>
      <header className={styles.intro}><span>THU NHẬP</span><h2>Thu nhập của tôi</h2>
        <p>Thông tin cá nhân từ kỳ lương tại cơ sở của bạn.</p></header>
      {centers.length>1?<label className={styles.card}>Cơ sở
        <select value={centerId} onChange={e=>setCenterId(e.target.value)}>
          {centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select></label>:null}
      {error?<p role="alert" className={styles.card}>{error}</p>:null}
      {loading?<p role="status" className={styles.card}>Đang tải lịch sử thu nhập…</p>:null}
      {!loading&&current?<section className={styles.hero}>
        <span className={styles.pill}>{label(current)}</span>
        <p>{current.name} · {date(current.startDate)} – {date(current.endDate)}</p>
        <strong>{money(current.amountMinor)}</strong>
        <small>{current.status==="DRAFT"&&!current.estimateAvailable
          ?"Chưa có số tạm tính được xác nhận từ payroll. Không suy đoán từ giờ chấm công."
          :"Số liệu từ nguồn payroll, không phải ước tính trên thiết bị."}</small>
      </section>:null}
      {!loading&&current&&current.amountMinor!==null?<section className={styles.card}>
        <h3>Chi tiết kỳ gần nhất</h3>
        <div className={styles.row}><span>Công chuẩn</span><strong>{money(current.standardMinor)}</strong></div>
        <div className={styles.row}><span>Làm thêm giờ</span><strong>{money(current.extraTimeMinor)}</strong></div>
        <div className={styles.row}><span>Điều chỉnh</span><strong>{money(current.adjustmentsMinor)}</strong></div>
        <div className={styles.row}><span>Trạng thái</span><strong>{label(current)}</strong></div>
      </section>:null}
      <section className={styles.card}><h3>Yêu cầu tính thêm giờ</h3>
        <p className={styles.muted}>Chỉ thời gian được BO duyệt mới được tính vào bảng lương.</p>
        <Link href="/earnings/extra-time" className={styles.action}>Tạo yêu cầu / Xem lịch sử →</Link>
      </section>
      {!loading?<section className={styles.card}><h3>Các kỳ lương</h3>
        {periods.length?periods.map(p=><div key={p.periodId} className={styles.row}>
          <span>{p.name}<br/>{date(p.startDate)} – {date(p.endDate)} · {label(p)}</span>
          <strong>{money(p.amountMinor)}</strong>
        </div>):<p className={styles.muted}>Chưa có kỳ lương được ghi nhận.</p>}
        {nextOffset!==null?<button type="button" disabled={more} onClick={()=>void loadMore()}>
          {more?"Đang tải…":"Xem thêm kỳ lương"}
        </button>:null}
      </section>:null}
    </div>
  </TosShell>;
}
