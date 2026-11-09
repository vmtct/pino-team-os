// PAP-1749 · shared app frame / bottom nav for all five app identities.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PINER_APPS } from "../catalog";
import { PinerAppScreen } from "../SharedShell";
type Props = { params: Promise<{ app: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return PINER_APPS.map(item => ({ app: item.id })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params;
  const entry = PINER_APPS.find(a => a.id === app);
  return { title: entry ? entry.label + " · Piner Space" : "Piner Space" };
}
export default async function PinerAppHome({ params }: Props) {
  const { app } = await params;
  const entry = PINER_APPS.find(a => a.id === app);
  if (!entry) notFound();
  return <PinerAppScreen app={entry} tab="home"/>;
}
