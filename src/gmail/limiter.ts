export class PerMinuteLimiter {
  private stamps: number[] = [];
  constructor(private maxPerMin: number) {}
  async take() {
    const now = Date.now();
    this.stamps = this.stamps.filter((t) => now - t < 60_000);
    if (this.stamps.length >= this.maxPerMin) {
      const wait = 60_000 - (now - this.stamps[0]);
      await new Promise((r) => setTimeout(r, wait));
      return this.take();
    }
    this.stamps.push(Date.now());
  }
}
