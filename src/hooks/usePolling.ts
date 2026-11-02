import { useEffect, useRef } from 'react';

/**
 * Runs `fn` immediately and then on an interval. Used for the dashboard queue
 * and the customer status page so both stay current even if realtime events
 * are missed — events are hints, REST is the record.
 */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const saved = useRef(fn);

  useEffect(() => {
    saved.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    const run = () => void saved.current();
    run();
    const id = window.setInterval(run, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}
