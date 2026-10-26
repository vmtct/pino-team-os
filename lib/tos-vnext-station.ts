/** PAP-943 six-app VNext: station is desktop-only, never a seventh app. */
export const STATION_DESKTOP_TABS=[
 {id:"overview",label:"Tổng quan"},
 {id:"pinoria",label:"Pinoria"},
 {id:"students",label:"Học viên"},
 {id:"devices",label:"Thiết bị"},
 {id:"tv",label:"TV"},
] as const;
export type StationDesktopTab=typeof STATION_DESKTOP_TABS[number]["id"];
export const stationHasVerifiedDeviceControl=false;
