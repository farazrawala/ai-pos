import { useEffect, useRef, useState } from 'react';

/**
 * When `isFailed` is true, counts down from `seconds` to 0 and calls `onRetry`.
 * Restarts the countdown each time the fetch fails again.
 *
 * @param {object} options
 * @param {boolean} options.isFailed - True while the load is in a failed state
 * @param {() => void} options.onRetry - Called when countdown reaches 0
 * @param {number} [options.seconds=5] - Countdown length
 * @param {boolean} [options.enabled=true] - Set false to disable auto-retry
 * @returns {{ countdown: number|null, isRetrying: boolean }}
 */
export function useFetchRetryCountdown({
  isFailed,
  onRetry,
  seconds = 5,
  enabled = true,
}) {
  const [countdown, setCountdown] = useState(null);
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;

  useEffect(() => {
    if (!enabled || !isFailed || typeof onRetryRef.current !== 'function') {
      setCountdown(null);
      return undefined;
    }

    const start = Math.max(1, Number(seconds) || 5);
    setCountdown(start);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, isFailed, seconds]);

  useEffect(() => {
    if (!enabled || !isFailed || countdown !== 0) return;
    if (typeof onRetryRef.current !== 'function') return;
    onRetryRef.current();
  }, [enabled, isFailed, countdown]);

  return {
    countdown,
    isRetrying: Boolean(enabled && isFailed),
  };
}

export default useFetchRetryCountdown;
