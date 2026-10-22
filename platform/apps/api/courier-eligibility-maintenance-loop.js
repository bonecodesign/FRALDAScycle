export function createCourierEligibilityMaintenanceLoop({
  repository, worker, intervalMs = 300_000, clock = Date.now, onError = () => {},
}) {
  let timer = null;
  let running = false;

  async function runOnce() {
    if (running) return { skipped: true, reason: "already_running" };
    running = true;
    try {
      const now = new Date(clock()).toISOString();
      const scheduled = await repository.scheduleMaintenanceTasks({ actorId: null, now });
      const processed = await worker.run();
      return { skipped: false, scheduled, processed };
    } finally {
      running = false;
    }
  }

  return Object.freeze({
    runOnce,
    start() {
      if (timer) return false;
      timer = setInterval(() => { void runOnce().catch(onError); }, intervalMs);
      timer.unref?.();
      void runOnce().catch(onError);
      return true;
    },
    stop() {
      if (!timer) return false;
      clearInterval(timer);
      timer = null;
      return true;
    },
    state() { return { started: Boolean(timer), running }; },
  });
}
