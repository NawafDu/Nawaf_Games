// -----------------------------------------------------------------------
// Character customization presets.
// All names, shapes, and palette choices below are original to Shadow
// Circuit and not derived from any existing game's assets or branding.
// Avatars are rendered procedurally (CSS/SVG shapes) — see
// src/components/common/Avatar.tsx — so no external image assets are
// required.
// -----------------------------------------------------------------------

export interface AvatarPreset {
  id: string;
  label: string;
  // Shape used for procedural rendering.
  shape: 'orb' | 'prism' | 'shard' | 'cube' | 'wisp' | 'bolt';
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'orb', label: 'Orb', shape: 'orb' },
  { id: 'prism', label: 'Prism', shape: 'prism' },
  { id: 'shard', label: 'Shard', shape: 'shard' },
  { id: 'cube', label: 'Cube', shape: 'cube' },
  { id: 'wisp', label: 'Wisp', shape: 'wisp' },
  { id: 'bolt', label: 'Bolt', shape: 'bolt' },
];

export interface ColorPreset {
  id: string;
  label: string;
  hex: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'teal', label: 'Teal', hex: '#5eead4' },
  { id: 'violet', label: 'Violet', hex: '#a78bfa' },
  { id: 'amber', label: 'Amber', hex: '#fbbf24' },
  { id: 'rose', label: 'Rose', hex: '#fb7185' },
  { id: 'lime', label: 'Lime', hex: '#a3e635' },
  { id: 'sky', label: 'Sky', hex: '#38bdf8' },
  { id: 'fuchsia', label: 'Fuchsia', hex: '#e879f9' },
  { id: 'orange', label: 'Orange', hex: '#fb923c' },
  { id: 'slate', label: 'Slate', hex: '#cbd5e1' },
  { id: 'emerald', label: 'Emerald', hex: '#34d399' },
  { id: 'indigo', label: 'Indigo', hex: '#818cf8' },
  { id: 'crimson', label: 'Crimson', hex: '#f87171' },
];

export function getAvatarPreset(id: string): AvatarPreset {
  return AVATAR_PRESETS.find((a) => a.id === id) ?? AVATAR_PRESETS[0];
}

export function getColorPreset(id: string): ColorPreset {
  return COLOR_PRESETS.find((c) => c.id === id) ?? COLOR_PRESETS[0];
}
