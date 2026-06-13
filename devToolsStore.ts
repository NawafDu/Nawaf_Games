import { create } from 'zustand';

// -----------------------------------------------------------------------
// Dev-only global state for the QA devtools panel. This store is created
// unconditionally (cheap — just a few primitives) but is only ever READ
// or rendered from dev-gated code paths (DevPanel and withDevLatency
// below both check `import.meta.env.DEV` themselves as a second layer of
// defense, so even if something accidentally imported this in a
// production bundle, it would be inert).
// -----------------------------------------------------------------------

export type LatencyPreset = 0 | 100 | 250 | 500 | 1000;

export type EventLogFilter =
  | 'all'
  | 'movement'
  | 'tasks'
  | 'kills'
  | 'reports'
  | 'meetings'
  | 'votes'
  | 'host_migration';

interface DevToolsState {
  panelOpen: boolean;
  /** Artificial delay (ms) applied to gameplay actions via withDevLatency. */
  latencyMs: LatencyPreset;
  /** Active eventLog type filter in the Event Log Viewer ('all' = none). */
  eventLogFilter: EventLogFilter;

  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  setLatency: (ms: LatencyPreset) => void;
  setEventLogFilter: (filter: EventLogFilter) => void;
}

export const useDevToolsStore = create<DevToolsState>((set) => ({
  panelOpen: false,
  latencyMs: 0,
  eventLogFilter: 'all',

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setLatency: (ms) => set({ latencyMs: ms }),
  setEventLogFilter: (filter) => set({ eventLogFilter: filter }),
}));

/**
 * Wraps a promise-returning gameplay action with the currently-configured
 * artificial latency (from the dev panel's Latency Simulation control).
 * In production builds (or when latency is 0), this resolves the action
 * immediately with no overhead — `import.meta.env.DEV` is statically
 * `false` in production, so the delay branch is dead-code-eliminated by
 * Vite/esbuild.
 *
 * Usage: `await withDevLatency(() => moveToNode(roomCode, uid, nodeId))`
 */
export async function withDevLatency<T>(action: () => Promise<T>): Promise<T> {
  if (import.meta.env.DEV) {
    const ms = useDevToolsStore.getState().latencyMs;
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }
  return action();
}
