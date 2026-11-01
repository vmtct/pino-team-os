"use client";

type Props = {
 index:number;
 total:number;
 displayName:string;
 editable:boolean;
 onMoveUp:()=>void;
 onMoveDown:()=>void;
 onRemove:()=>void;
};

// PAP-1287: domain-owned SET controls with unambiguous accessible action names.
export function HoSetMemberControls({index,total,displayName,editable,onMoveUp,onMoveDown,onRemove}:Props){
 const ordinal=index+1;
 return <div className="ho-rel-member-actions">
  <button className="secondary-btn" type="button"
   aria-label={`Đưa ${displayName} lên (thành viên ${ordinal})`}
   disabled={!editable||index===0} onClick={onMoveUp}>↑</button>
  <button className="secondary-btn" type="button"
   aria-label={`Đưa ${displayName} xuống (thành viên ${ordinal})`}
   disabled={!editable||index===total-1} onClick={onMoveDown}>↓</button>
  <button className="secondary-btn" type="button"
   aria-label={`Bỏ ${displayName} khỏi Set (thành viên ${ordinal})`}
   disabled={!editable} onClick={onRemove}>Bỏ</button>
 </div>;
}
