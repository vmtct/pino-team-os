import { notFound } from "next/navigation";
import fontStyles from "../../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../../pinoria-vietnamese-locale";
import { getLostArtifact, LOST_ARTIFACTS } from "../../../lost-artifact-data";
import { LostArtifactScene } from "../../../lost-artifact-scene";

export function generateStaticParams() {
  return LOST_ARTIFACTS.map((artifact) => ({ artifactId: artifact.id }));
}

export default async function LostArtifactReviewPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;
  const artifact = getLostArtifact(artifactId);
  if (!artifact) notFound();

  return (
    <PinoriaVietnameseLocale>
      <main className={fontStyles.vnFont} lang="vi">
        <LostArtifactScene artifact={artifact} />
      </main>
    </PinoriaVietnameseLocale>
  );
}
