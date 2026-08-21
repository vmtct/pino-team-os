"use client";

import type { CSSProperties, ReactNode } from "react";

export const PINORIA_STAGE_WIDTH = 1920;
export const PINORIA_STAGE_HEIGHT = 1080;
export const PINORIA_STAGE_ASPECT = PINORIA_STAGE_WIDTH / PINORIA_STAGE_HEIGHT;

export type PinoriaStageRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function fitPinoriaStageRect(container: PinoriaStageRect): PinoriaStageRect {
  const scale = Math.min(container.width / PINORIA_STAGE_WIDTH, container.height / PINORIA_STAGE_HEIGHT);
  const width = PINORIA_STAGE_WIDTH * scale;
  const height = PINORIA_STAGE_HEIGHT * scale;
  return {
    left: container.left + (container.width - width) / 2,
    top: container.top + (container.height - height) / 2,
    width,
    height,
  };
}

export function PinoriaStage({
  children,
  style,
  dataStage,
}: {
  children: ReactNode;
  style?: CSSProperties;
  dataStage?: string;
}) {
  return (
    <div
      data-pinoria-stage={dataStage ?? "tv"}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: "min(100vw, 177.777778vh)",
        height: "min(100vh, 56.25vw)",
        transform: "translate(-50%,-50%)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
