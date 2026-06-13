import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  pending?: boolean;
  children: ReactNode;
}

const VARIANT_STYLES: Record<string, string> = {
  primary: 'bg-signal text-ink-950',
  secondary: 'bg-ink-700 text-white',
  outline: 'border border-white/15 text-white/80',
  danger: 'bg-alert text-ink-950',
  ghost: 'text-white/60',
};

/**
 * Standard tap-target-sized button. `pending` disables the button and
 * shows a spinner, preventing duplicate taps from triggering the action
 * twice (paired with useAsyncAction).
 */
export function Button({
  variant = 'primary',
  pending = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || pending}
      className={`tap-target flex items-center justify-center gap-2 rounded-xl2 py-4 font-display text-base font-semibold transition active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${VARIANT_STYLES[variant]} ${className}`}
      {...rest}
    >
      {pending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
