import { useState } from 'react';

interface RoomCodeCardProps {
  code: string;
}

export function RoomCodeCard({ code }: RoomCodeCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const shareText = `Join my Shadow Circuit room! Code: ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        return;
      }
    } catch {
      // User cancelled share sheet or it failed — fall through to clipboard.
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — no-op; code is visible on screen.
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl2 bg-ink-800 px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
          Room Code
        </p>
        <p className="font-display text-2xl font-bold tracking-[0.25em] text-white">
          {code}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="tap-target rounded-xl2 bg-signal px-4 py-2.5 font-display text-sm font-semibold text-ink-950 active:scale-95"
      >
        {copied ? 'Copied!' : 'Invite'}
      </button>
    </div>
  );
}
