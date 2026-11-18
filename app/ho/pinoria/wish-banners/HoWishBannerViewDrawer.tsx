"use client";
/** PAP-2030 / PNR-WISH — native View only. Item ledger belongs to Detail Item tab. */
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import type {BannerValue,WishConfigHead} from "@/lib/pls-wish-ho-contract";
import {bannerView,wishBannerModule} from "./wish-banner-view";
type Props={head:WishConfigHead<BannerValue>;selection:"published"|"pending";centerLabel:string|null;onClose:()=>void;onDetail?:()=>void};
export function HoWishBannerViewDrawer({head,selection,centerLabel,onClose,onDetail}:Props){
 const view=bannerView(head,selection,centerLabel);
 return <BoQuickView moduleKey="wish-banners" module={wishBannerModule} legacyStyles record={view.row} onClose={onClose} onDetail={onDetail} hideDetailAction={!onDetail}/>;
}
