/** The visible Center and request generation must still match before accepting any result. */
export function isCurrentOperatorQueueResponse(
  requestedCenter: string,
  requestedGeneration: number,
  visibleCenter: string,
  currentGeneration: number,
): boolean {
  return requestedCenter === visibleCenter &&
    requestedGeneration === currentGeneration;
}
