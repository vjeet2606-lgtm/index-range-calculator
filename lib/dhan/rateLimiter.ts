const MIN_INTERVAL_MS = 3000; // Dhan option-chain limit: 1 request per 3 seconds

let lastCallAt = 0;
let queue: Promise<void> = Promise.resolve();

/**
 * Serializes calls so consecutive Dhan option-chain requests are spaced at
 * least MIN_INTERVAL_MS apart, instead of erroring out on rate limits.
 */
export function throttleDhanCall<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastCallAt = Date.now();
  });

  queue = run.catch(() => undefined);

  return run.then(fn);
}
