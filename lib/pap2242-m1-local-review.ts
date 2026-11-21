/** PAP-2242: fail-closed gate for the local-only M1 visual review route. */
export type Pap2242LocalReviewEnv = Readonly<Record<string, string | undefined>>;

export function isPap2242M1LocalReviewEnabled(env: Pap2242LocalReviewEnv = process.env): boolean {
  return env.NODE_ENV === "development" && env.BO_M1_LOCAL_REVIEW === "1";
}
