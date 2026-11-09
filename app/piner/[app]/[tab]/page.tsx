// PAP-1749 · nested slash routes: each app has its own real navigation pages.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PINER_APPS } from "../../catalog";
import { APP_NAV } from "../../navigation";
import { PinerAppScreen } from "../../SharedShell";
type Props = { params: Promise<{ app: string; tab: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return PINER_APPS.flatMap(app =>
    APP_NAV[app.id].filter(item => item.id !== "home").map(item => ({ app: app.id, tab: item.id }))
  );
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app, tab } = await params;
  const entry = PINER_APPS.find(a => a.id === app);
  const nav = entry && APP_NAV[entry.id].find(n => n.id === tab);
  return { title: entry && nav ? nav.label + " · " + entry.label + " · Piner Space" : "Piner Space" };
}
export default async function PinerAppTab({ params }: Props) {
  const { app, tab } = await params;
  const entry = PINER_APPS.find(a => a.id === app);
  if (!entry || !APP_NAV[entry.id].some(item => item.id === tab && tab !== "home")) notFound();
  return <PinerAppScreen app={entry} tab={tab}/>;
}
