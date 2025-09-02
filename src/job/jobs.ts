type JobFn = () => Promise<void>;

const running = new Map<string, Promise<void>>(); // key = userId

export function startUniqueJob(key: string, fn: JobFn) {
  if (running.has(key)) return false;
  const p = (async () => {
    try {
      await fn();
    } finally {
      running.delete(key);
    }
  })();
  running.set(key, p);
  return true;
}

export function isRunning(key: string) {
  return running.has(key);
}
