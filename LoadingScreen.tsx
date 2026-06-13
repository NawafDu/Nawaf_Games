interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading…' }: LoadingScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950 safe-area-screen">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-signal" />
      <p className="font-body text-sm text-white/50">{message}</p>
    </div>
  );
}
