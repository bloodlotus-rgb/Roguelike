import { Session, type HeapProfiler } from 'node:inspector';

const sampling = { samplingInterval: 64 * 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true };

function sampledBytes(node: HeapProfiler.SamplingHeapProfileNode): number {
  return node.children.reduce((sum, child) => sum + sampledBytes(child), node.selfSize);
}

/** Heap deltas include GC, not lifetime allocation counts. RSS is the process high-water mark. */
export class Profile {
  private samples = new Map<string, { times: number[]; heapDelta: number; allocated: number; units: number }>();
  private clock = performance.now();
  private heap = process.memoryUsage().heapUsed;

  private session?: Session;

  constructor(allocations = false) {
    if (allocations) {
      this.session = new Session();
      this.session.connect();
      this.session.post('HeapProfiler.startSampling', sampling);
    }
  }

  private finishSample() {
    let bytes = 0;
    // This session is attached to the current thread; local profiler commands complete synchronously.
    this.session?.post('HeapProfiler.stopSampling', (error, data) => {
      if (error) throw error;
      bytes = sampledBytes(data.profile.head);
    });
    return bytes;
  }

  start() {
    if (this.session) {
      this.finishSample();
      this.session.post('HeapProfiler.startSampling', sampling);
    }
    this.heap = process.memoryUsage().heapUsed;
    this.clock = performance.now();
  }

  end = (name: string, units = 0) => {
    const now = performance.now(), heap = process.memoryUsage().heapUsed;
    const sample = this.samples.get(name) ?? { times: [], heapDelta: 0, allocated: 0, units: 0 };
    if (this.session) {
      sample.allocated += this.finishSample();
      this.session.post('HeapProfiler.startSampling', sampling);
    }
    sample.times.push(now - this.clock);
    sample.heapDelta += heap - this.heap;
    sample.units += units;
    this.samples.set(name, sample);
    this.clock = now;
    this.heap = heap;
  };

  report() {
    if (this.session) {
      this.finishSample();
      this.session.disconnect();
    }
    return Object.fromEntries([...this.samples].map(([name, sample]) => {
      const times = sample.times.sort((a, b) => a - b);
      const totalMs = times.reduce((a,b) => a+b, 0);
      return [name, { calls: times.length, totalMs, meanMs: totalMs / times.length,
        p95Ms: times[Math.ceil(times.length * 0.95) - 1], netHeapMiB: sample.heapDelta / 2**20, units: sample.units,
        estimatedAllocatedMiB: this.session ? sample.allocated / 2**20 : undefined }];
    }));
  }
}
