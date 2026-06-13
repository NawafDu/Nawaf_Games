import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="w-10">
        {onBack && (
          <button
            onClick={onBack}
            className="tap-target -ml-2 flex items-center justify-center rounded-full text-2xl text-white/70 active:scale-90"
            aria-label="Back"
          >
            ‹
          </button>
        )}
      </div>
      <h1 className="font-display text-base font-semibold text-white">{title}</h1>
      <div className="flex w-10 justify-end">{right}</div>
    </div>
  );
}
