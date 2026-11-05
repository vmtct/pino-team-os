import { notFound } from "next/navigation";

/** PAP-1460 / Epic PAP-1316: Founder retired BO TV management route.
 * Preserve TvsTdd.tsx, schema, old Git history and TV audit evidence.
 * HO is the only TV management surface; BO never redirects into Founder HO.
 */
export default function RetiredBoTvPage() {
  notFound();
}
