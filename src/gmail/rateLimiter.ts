export class RateLimiter {
  private intervalMs: number;
  private maxPerInterval: number;
  private queue: (() => void)[] = [];
  private running = 0;
  private timestamps: number[] = [];

  constructor(maxPerMin: number) {
    this.intervalMs = 60_000;
    this.maxPerInterval = maxPerMin;
  }

  async take() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.intervalMs);

    if (this.timestamps.length >= this.maxPerInterval) {
      const wait = this.intervalMs - (now - this.timestamps[0]);
      await new Promise((res) => setTimeout(res, wait));
      return this.take();
    } else {
      this.timestamps.push(Date.now());
    }
  }
}
