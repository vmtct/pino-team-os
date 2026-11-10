"use client";
// PAP-1765 · prototype-only consent/visibility dialog. NO real identity/ACL/backend writes.
import { useEffect, useState } from "react";
import type { MediaPost } from "./media";
import css from "./launcher.module.css";
import {getProfile} from "./profiles";

export function VisibilityDialog({ post, onCancel, onConfirm }: {
  post: MediaPost;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isShare = post.visibility === "private";
  const isMyTime = getProfile(post.ownerId).kind === "adult";
  const audience = isMyTime?"Cộng đồng MyTime":"Cộng đồng phụ huynh PINO";
  const [consented, setConsented] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return <div className={css.modalBackdrop} role="presentation"
    onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className={css.visibilityDialog} role="dialog" aria-modal="true"
      aria-label={isShare ? "Chia sẻ bài đăng" : "Ẩn bài đăng"}
      onKeyDown={(event) => {
        if(event.key !== "Tab")return;
        const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
        if(!items.length)return;
        if(event.shiftKey && document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus();}
        else if(!event.shiftKey && document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus();}
      }}>
      <div className={css.visibilityDialogHead}>
        <span className={css.visibilityDialogIcon} aria-hidden="true">{isShare ? "↗" : "↶"}</span>
        <button type="button" onClick={onCancel} className={css.visibilityClose} aria-label="Đóng" autoFocus>✕</button>
      </div>
      <h2>{isShare ? "Chia sẻ khoảnh khắc này?" : "Ẩn khỏi Cộng đồng?"}</h2>
      <p className={css.visibilitySubtitle}><strong>{post.title}</strong></p>
      {isShare ? <>
        <p className={css.visibilityDescription}>Bài đang ở chế độ <strong>Riêng tư</strong>.
          Bạn có thể chọn chia sẻ với {audience}.</p>
        <div className={css.audienceOption} aria-label="Phạm vi chia sẻ">
          <span className={css.audienceIcon} aria-hidden="true">♧</span>
          <div><strong>{audience}</strong>
            <small>Chỉ hiển thị trong mục Cộng đồng của ứng dụng này.</small></div>
          <span className={css.audienceCheck} aria-hidden="true">✓</span>
        </div>
        <label className={css.consentCheck}>
          <input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} />
          <span>{isMyTime?"Tôi xác nhận đây là thành quả của mình và đồng ý chia sẻ với Cộng đồng MyTime.":"Tôi xác nhận có quyền chia sẻ nội dung này với cộng đồng phụ huynh PINO."}</span>
        </label>
        <p className={css.visibilityCaution}>Chỉ là thao tác mô phỏng trên trình duyệt; chưa xác minh phụ huynh,
          chưa ghi nhận đồng ý pháp lý hoặc gửi dữ liệu đến máy chủ.</p>
      </> : <>
        <p className={css.visibilityDescription}>Bài sẽ trở lại <strong>Riêng tư</strong>
          và biến mất khỏi mục Cộng đồng. Nội dung trong hành trình cá nhân vẫn được giữ lại.</p>
        <p className={css.visibilityCaution}>Bản thử chỉ lưu thay đổi trong phiên trình duyệt;
          không tác động tới dữ liệu thật.</p>
      </>}
      <div className={css.visibilityButtons}>
        <button type="button" className={css.visibilityCancel} onClick={onCancel}>Hủy</button>
        <button type="button" data-confirm-visibility
          className={isShare ? css.visibilityConfirm : css.visibilityRevoke}
          disabled={isShare && !consented} onClick={onConfirm}>
          {isShare ? "Xác nhận chia sẻ" : "Ẩn bài đăng"}
        </button>
      </div>
    </section>
  </div>;
}
