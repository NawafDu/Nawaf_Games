import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { isDevMultiTabIdentityEnabled, setDevMultiTabIdentity } from '@/lib/devtools/devIdentity';

/**
 * Identity tab: shows the current tab's uid/role, and lets the tester
 * toggle "multi-tab identity" mode (per-tab anonymous identity instead
 * of the shared-across-tabs default) — see devIdentity.ts for the full
 * explanation. Toggling reloads the current tab only.
 */
export default function DevIdentitySection() {
  const uid = useAuthStore((s) => s.uid);
  const preferredName = useAuthStore((s) => s.preferredName);
  const { room } = useRoomStore();
  const multiTab = isDevMultiTabIdentityEnabled();

  const me = room && uid ? room.players[uid] : null;
  const isHost = me?.isHost ?? false;
  const roomUrl = room ? `${window.location.origin}${window.location.pathname}` : null;

  return (
    <div className="space-y-4">
      <section className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-1.5">
        <h3 className="font-display text-warn">This Tab</h3>
        <Row label="UID" value={uid ?? '—'} mono />
        <Row label="Display name" value={me?.displayName ?? (preferredName || '—')} />
        <Row label="Room" value={room?.code ?? 'not in a room'} mono />
        <Row label="Role in room" value={isHost ? 'Host' : me ? 'Player' : '—'} />
      </section>

      <section className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-2">
        <h3 className="font-display text-warn">Multi-Tab Identity</h3>
        <p className="text-white/50 leading-relaxed">
          By default, all tabs/windows in this browser share ONE anonymous
          identity (Firebase persists it across tabs) — so you can't join
          the same room as two different players from two tabs.
        </p>
        <p className="text-white/50 leading-relaxed">
          Enabling this gives <strong className="text-white/80">this tab only</strong> its
          own independent identity (in-memory; resets on reload). Other
          tabs are unaffected — enable it in EACH tab you want to use as a
          separate player.
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className={multiTab ? 'text-signal' : 'text-white/60'}>
            {multiTab ? 'Enabled for this tab' : 'Disabled (shared identity)'}
          </span>
          <button
            type="button"
            onClick={() => setDevMultiTabIdentity(!multiTab)}
            className="rounded-lg bg-warn text-ink-950 px-3 py-1.5 font-medium active:scale-95"
          >
            {multiTab ? 'Disable & Reload' : 'Enable & Reload'}
          </button>
        </div>
      </section>

      <section className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-2">
        <h3 className="font-display text-warn">Multi-Tab Workflow</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-white/60 leading-relaxed">
          <li>
            Open 4-12 tabs/windows to this URL{roomUrl ? ':' : '.'}
            {roomUrl && (
              <code className="block mt-1 bg-ink-800 rounded px-2 py-1 text-white/80 break-all">{roomUrl}</code>
            )}
          </li>
          <li>In each tab, open this panel → Identity → "Enable &amp; Reload".</li>
          <li>In each tab, set a distinct name (Home → Create/Join), then join the same room code.</li>
          <li>Use the Debug tab in each tab's panel to confirm distinct UIDs and to identify which tab is currently host.</li>
        </ol>
        <p className="text-white/40">
          Tip: use your browser's "duplicate tab" or open new windows —
          regular Incognito/Private windows ALSO share identity with each
          other (same profile), so multi-tab identity mode is the
          reliable option.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span className={['text-white/90 text-right truncate', mono ? 'font-mono' : ''].join(' ')}>{value}</span>
    </div>
  );
}
