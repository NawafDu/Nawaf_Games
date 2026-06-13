import { useCallback, useRef, useState } from 'react';

/**
 * Wraps an async action so it can only run once at a time. Returns the
 * wrapped handler plus a `pending` flag for disabling buttons / showing
 * spinners. Prevents duplicate Firebase writes from rapid double-taps,
 * which is especially common on touchscreens.
 */
export function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>
): [(...args: Args) => void, boolean] {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const wrapped = useCallback(
    (...args: Args) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      action(...args)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[useAsyncAction] action failed:', err);
        })
        .finally(() => {
          pendingRef.current = false;
          setPending(false);
        });
    },
    [action]
  );

  return [wrapped, pending];
}
