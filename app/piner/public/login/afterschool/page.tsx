// PAP-1884 / Epic PAP-1832 PNR-IDENTITY — Afterschool PIN G0 prototype.
import type {Metadata} from "next";
import AfterschoolPinDemo from "./AfterschoolPinDemo";
export const metadata:Metadata={title:"Đăng nhập PIN · PINO Afterschool",robots:{index:false,follow:false}};
type Props={searchParams:Promise<{returnTo?:string}>};
export default async function AfterschoolLogin({searchParams}:Props){
 const raw=(await searchParams).returnTo||"/piner/public";
 const returnTo=raw.startsWith("/piner")&&!raw.startsWith("//")&&!raw.includes("://")?raw:"/piner/public";
 return <AfterschoolPinDemo returnTo={returnTo}/>;
}
