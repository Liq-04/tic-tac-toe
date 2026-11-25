import type { Verdict } from '../bot';

export interface VerdictStyle {
  label: string;
  /** Chess notation. */
  glyph: string;
  className: string;
}

export const VERDICTS: Record<Verdict['kind'], VerdictStyle> = {
  blunder: { label: 'Blunder', glyph: '??', className: 'verdict-blunder' },
  missed: { label: 'Miss', glyph: '?', className: 'verdict-missed' },
  great: { label: 'Great', glyph: '!!', className: 'verdict-great' },
};

/** In the order the key moves list counts them. */
export const VERDICT_KINDS = ['great', 'missed', 'blunder'] as const satisfies readonly Verdict['kind'][];

export const BEST_MOVE: VerdictStyle = { label: 'Best move', glyph: '★', className: 'verdict-best' };
