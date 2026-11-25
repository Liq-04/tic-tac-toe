import type { Verdict } from '../bot';

export interface VerdictStyle {
  label: string;
  /** Chess notation. */
  glyph: string;
  className: string;
}

export const VERDICTS: Record<Verdict['kind'], VerdictStyle> = {
  blunder: { label: 'Blunder', glyph: '??', className: 'verdict-blunder' },
  missed: { label: 'Missed chance', glyph: '?', className: 'verdict-missed' },
  great: { label: 'Great move', glyph: '!!', className: 'verdict-great' },
};
