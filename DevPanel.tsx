import { useState } from 'react';
import { useDevToolsStore } from '@/lib/devtools/devToolsStore';
import DevIdentitySection from './DevIdentitySection';
import DevDebugInfoSection from './DevDebugInfoSection';
import DevSimulationSection from './DevSimulationSection';
import DevBotPresetsSection from './DevBotPresetsSection';
import DevLatencySection from './DevLatencySection';
import DevEventLogSection from './DevEventLogSection';
import DevStateInspectorSection from './DevStateInspectorSection';

type Tab = 'identity' | 'debug' | 'simulate' | 'bots' | 'latency' | 'events' | 'state';

const TABS: { id: Tab; label: string }[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'debug', label: 'Debug' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'bots', label: 'Bots' },
  { id: 'latency', label: 'Latency' },
  { id: 'events', label: 'Events' },
  { id: 'state', label: 'State' },
];

/**
 * Floating QA devtools panel. ONLY rendered when `import.meta.env.DEV`
 * (see App.tsx) — never present in production builds, regardless of any
 * runtime flags, since `import.meta.env.DEV` is statically `false` in
 * production and the whole subtree (including this file's code) is
 * dead-code-eliminated by Vite/esbuild.
 *
 * Provides the Phase 3.5 QA tooling: multi-tab identity switching, a
 * live debug info panel, simulation tools (force disconnect/reconnect/
 * meeting/vote/etc.), latency injection, an event log viewer, and a raw
 * state inspector — see docs/TEST_CHECKLIST.md for the corresponding QA
 * scenarios each tool supports.
 */
export default function DevPanel() {
  const panelOpen = useDevToolsStore((s) => s.panelOpen);
  const togglePanel = useDevToolsStore((s) => s.togglePanel);
  const [tab, setTab] = useState<Tab>('debug');

  return (
    <>
      {/* Floating toggle button — always visible in dev */}
      <button
        type="button"
        onClick={togglePanel}
        className="fixed bottom-4 right-4 z-[100] w-12 h-12 rounded-full bg-warn text-ink-950 font-display text-xs font-bold shadow-lg flex items-center justify-center active:scale-95"
        aria-label="Toggle QA dev panel"
      >
        QA
      </button>

      {panelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[99] max-h-[75vh] bg-ink-950 border-t-2 border-warn rounded-t-2xl flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-ink-700">
            <span className="font-display text-xs text-warn">QA Devtools</span>
            <button
              type="button"
              onClick={togglePanel}
              className="w-8 h-8 flex items-center justify-center text-white/50 active:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex overflow-x-auto border-b border-ink-800 shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  'px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                  tab === t.id ? 'border-warn text-warn' : 'border-transparent text-white/50',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 text-xs">
            {tab === 'identity' && <DevIdentitySection />}
            {tab === 'debug' && <DevDebugInfoSection />}
            {tab === 'simulate' && <DevSimulationSection />}
            {tab === 'bots' && <DevBotPresetsSection />}
            {tab === 'latency' && <DevLatencySection />}
            {tab === 'events' && <DevEventLogSection />}
            {tab === 'state' && <DevStateInspectorSection />}
          </div>
        </div>
      )}
    </>
  );
}
