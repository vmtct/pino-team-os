export interface StaffPrivateRevealFence {
  begin(): number;
  invalidate(): void;
  accepts(token: number): boolean;
}

export function createStaffPrivateRevealFence(): StaffPrivateRevealFence {
  let generation = 0;
  return {
    begin() {
      generation += 1;
      return generation;
    },
    invalidate() {
      generation += 1;
    },
    accepts(token) {
      return token === generation;
    },
  };
}
