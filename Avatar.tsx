import { getAvatarPreset, getColorPreset } from '@/lib/presets';

interface AvatarProps {
  avatarId: string;
  colorId: string;
  size?: number;
  className?: string;
}

/**
 * Renders a player's avatar as a simple procedural SVG shape in their
 * chosen color. No external image assets — keeps the app lightweight
 * and avoids any visual resemblance to existing games' character
 * designs.
 */
export function Avatar({ avatarId, colorId, size = 48, className = '' }: AvatarProps) {
  const avatar = getAvatarPreset(avatarId);
  const color = getColorPreset(colorId);

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-ink-800 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        {avatar.shape === 'orb' && (
          <circle cx="12" cy="12" r="9" fill={color.hex} />
        )}
        {avatar.shape === 'prism' && (
          <polygon points="12,2 22,20 2,20" fill={color.hex} />
        )}
        {avatar.shape === 'shard' && (
          <polygon points="12,1 19,12 12,23 5,12" fill={color.hex} />
        )}
        {avatar.shape === 'cube' && (
          <rect x="3" y="3" width="18" height="18" rx="3" fill={color.hex} />
        )}
        {avatar.shape === 'wisp' && (
          <path
            d="M12 2 C18 2 22 6 22 12 C22 18 18 22 12 22 C9 22 7 19 9 17 C12 14 8 12 8 9 C8 5 9 2 12 2 Z"
            fill={color.hex}
          />
        )}
        {avatar.shape === 'bolt' && (
          <polygon points="13,1 4,13 11,13 9,23 20,11 12,11" fill={color.hex} />
        )}
      </svg>
    </div>
  );
}
