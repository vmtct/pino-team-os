// PAP-1803 · Login UI G3 only. This mock NEVER handles or transmits credentials.
import Link from "next/link";
import type {Metadata} from "next";
import css from "../../launcher.module.css";
export const metadata:Metadata={title:"Đăng nhập PINO · Piner Space",robots:{index:false,follow:false}};
type Props={searchParams:Promise<{returnTo?:string}>};
export default async function PublicLogin({searchParams}:Props){
 const raw=(await searchParams).returnTo||"/piner/public";
 const returnTo=raw.startsWith("/piner")&&!raw.startsWith("//")&&!raw.includes("://")?raw:"/piner/public";
 return <section className={css.guestLoginCard} data-login-gate="mock">
  <div className={css.guestLoginIcon} aria-hidden="true">✿</div>
  <h1>Đăng nhập PINO</h1>
  <p>Để yêu thích, bình luận, theo dõi hoặc mở hành trình riêng, vui lòng đăng nhập.</p>
  <label htmlFor="guest-email">Email hoặc số điện thoại</label>
  <input id="guest-email" type="text" autoComplete="off" placeholder="Email / Số điện thoại"/>
  <label htmlFor="guest-pass">Mật khẩu</label>
  <input id="guest-pass" type="password" autoComplete="off" placeholder="Mật khẩu"/>
  <button type="button" disabled title="Prototype chưa kết nối xác thực">Đăng nhập</button>
  <small role="status">Prototype local: chưa kết nối xác thực; không gửi hoặc lưu thông tin đăng nhập.</small>
  <Link href={returnTo} className={css.guestLoginBack}>‹ Quay lại trang đang xem</Link>
 </section>;
}
