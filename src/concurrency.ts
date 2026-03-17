// ─────────────────────────────────────────────
//  Concurrency — Async Semaphore
//  Prevents Playwright from spawning unlimited
//  browser instances under heavy load.
// ─────────────────────────────────────────────

export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.permits = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// Shared singleton — controlled by MAX_CONCURRENT env var (default 5)
export const globalSemaphore = new Semaphore(
  parseInt(process.env.MAX_CONCURRENT ?? "5", 10)
);
