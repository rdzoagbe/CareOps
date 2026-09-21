/**
 * Deterministic pseudo-random source, ported verbatim from the prototype.
 *
 * The whole synthetic dataset is generated from one linear congruential
 * generator seeded with 20260920. Order of calls is therefore part of the
 * contract: changing the order of generation changes every downstream figure.
 * The tests in `seed.test.ts` pin the resulting counts and totals.
 */
export class Lcg {
  private s: number;

  constructor(seed: number) {
    this.s = seed;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) % 4294967296;
    return this.s / 4294967296;
  }

  /** Integer in [a, b], inclusive. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export const SEED = 20260920;
