/** Heap deltas include GC, not lifetime allocation counts. RSS is the process high-water mark. */
export class Profile {
  private samples = new Map<string, { times: number[]; heapDelta: number; units: number }>();
  private clock = performance.now();
  private heap = process.memoryUsage().heapUsed;

  start() {
    this.heap = process.memoryUsage().heapUsed;
    this.clock = performance.now();
  }

  end = (name: string, units = 0) => {
    const now = performance.now(), heap = process.memoryUsage().heapUsed;
    const sample = this.samples.get(name) ?? { times: [], heapDelta: 0, units: 0 };
    sample.times.push(now - this.clock);
    sample.heapDelta += heap - this.heap;
    sample.units += units;
    this.samples.set(name, sample);
    this.clock = now;
    this.heap = heap;
  };

  report() {
    return Object.fromEntries([...this.samples].map(([name, sample]) => {
      const times = sample.times.sort((a, b) => a - b);
      const totalMs = times.reduce((a,b) => a+b, 0);
      return [name, { calls: times.length, totalMs, meanMs: totalMs / times.length,
        p95Ms: times[Math.ceil(times.length * 0.95) - 1], netHeapMiB: sample.heapDelta / 2**20, units: sample.units }];
    }));
  }
}
