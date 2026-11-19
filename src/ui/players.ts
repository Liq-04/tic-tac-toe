import type { Mode, PlayerId } from '../game';

export const SHAPES = {
  x: 'M6 6L18 18M18 6L6 18',
  o: 'M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
  t: 'M12 4.5L20 18.5H4Z',
  s: 'M5.5 5.5H18.5V18.5H5.5Z',
} as const;

export interface PlayerStyle {
  d: string;
  color: string;
  ink: string;
  tint: string;
}

export const PLAYER_STYLES: readonly PlayerStyle[] = [
  { d: SHAPES.x, color: '#2563EB', ink: '#1D4ED8', tint: '#E8F0FE' },
  { d: SHAPES.o, color: '#EA580C', ink: '#C2410C', tint: '#FDEEE4' },
  { d: SHAPES.t, color: '#0D9488', ink: '#0F766E', tint: '#E0F2F0' },
  { d: SHAPES.s, color: '#9333EA', ink: '#7E22CE', tint: '#F3E8FD' },
];

export function styleOf(id: PlayerId): PlayerStyle {
  const style = PLAYER_STYLES[id];
  if (!style) throw new Error(`no style for player ${id}`);
  return style;
}

export const POSITIONS = [
  'top-left',
  'top-middle',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-middle',
  'bottom-right',
] as const;

export function position(digit: number): string {
  return POSITIONS[digit] ?? 'unknown';
}

/** Names of each level below the top board, outermost first. */
export const LEVEL_NAMES: Record<Mode, readonly string[]> = {
  ultimate: ['small board', 'square'],
  omega: ['large board', 'small board', 'square'],
};

export const MODE_LABEL: Record<Mode, string> = { ultimate: 'Ultimate', omega: 'Omega' };
