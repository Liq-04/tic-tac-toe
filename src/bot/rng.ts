export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0 || 0x9e3779b9;
  }

  below(n: number): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x;
    return ((x >>> 16) * n) >>> 16;
  }
}
