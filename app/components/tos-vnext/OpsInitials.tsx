import css from "./ops.module.css";
/** Neutral semantic avatar; no arbitrary inline palette from user data. */
export function Initials({text}:{text:string}){return <span className={css.avatar}>{text}</span>}
