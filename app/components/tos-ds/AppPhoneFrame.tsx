import type {ReactNode} from "react";
import css from "./phone-frame.module.css";
export default function AppPhoneFrame({app,viewport=false,navigation=false,children}:{
 app:"home"|"shift"|"reception"|"classroom"|"training"|"design-system";
 viewport?:boolean;navigation?:boolean;children:ReactNode;
}){return <div className={css.phoneFrame} data-tos-system data-tos-phone-frame={app}
 data-tos-frame-mode={viewport?"viewport":"document"} data-tos-frame-navigation={navigation||undefined}
 data-tos-mobile-frame={app==="shift"||app==="classroom"?app:undefined}>{children}</div>}
