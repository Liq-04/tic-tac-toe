import { useState } from 'react';
import type { Config, Mode } from '../game';
import { Mark } from './Mark';
import { PLAYER_STYLES, MODE_LABEL } from './players';

function gridPath(n: number): string {
  let d = '';
  for (let i = 1; i < n; i++) {
    const p = +((54 * i) / n).toFixed(2);
    d += `M${p} 0V54M0 ${p}H54`;
  }
  return d;
}

const MODES: { id: Mode; desc: string; fine: string; mid: string }[] = [
  { id: 'ultimate', desc: '9 boards · 81 squares', fine: gridPath(9), mid: '' },
  { id: 'omega', desc: '81 boards · 729 squares', fine: gridPath(27), mid: gridPath(9) },
];

function winRule(mode: Mode, count: number): { title: string; text: string } {
  if (count === 2) {
    return {
      title: 'Three in a row wins',
      text:
        mode === 'ultimate'
          ? 'Win a small board to claim its square on the big board. First to three big squares in a row wins.'
          : 'Win small boards to claim large boards, and large boards to claim the top board. First to three in a row at the top wins.',
    };
  }
  return {
    title: 'Most boards wins',
    text:
      mode === 'ultimate'
        ? 'Each small board you win is 1 point. Highest score when play runs out wins. Three in a row on the big board claims all 9 and ends it.'
        : 'Each small board you win is 1 point. Three in a row inside a large board claims it outright: all 9 boards become yours, worth 9 points, and everyone else loses theirs there.',
  };
}

interface Props {
  initial: Config;
  onStart: (config: Config) => void;
  onPlayOnline: (config: Config) => void;
}

export function Setup({ initial, onStart, onPlayOnline }: Props) {
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [count, setCount] = useState(initial.players.length);
  const [names, setNames] = useState<string[]>(() =>
    PLAYER_STYLES.map((_, i) => initial.players[i]?.name ?? ''),
  );
  const rule = winRule(mode, count);

  const config = (): Config => ({
    mode,
    players: names.slice(0, count).map((name, i) => ({ name: name.trim() || `Player ${i + 1}` })),
  });

  return (
    <div className="setup">
      <div className="setup-intro">
        <h1>Ultimate Tic-Tac-Toe</h1>
        <p>Tic-tac-toe inside tic-tac-toe. Where you play decides where the next player goes.</p>
      </div>
      <div className="setup-card">
        <section>
          <h2 className="eyebrow">Mode</h2>
          <div className="mode-grid">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className="mode-card"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                <svg width="56" height="56" viewBox="0 0 54 54" fill="none" aria-hidden="true">
                  <path d={m.fine} stroke="#D1D5DB" strokeWidth="0.6" />
                  {m.mid && <path d={m.mid} stroke="#9CA3AF" strokeWidth="1.1" />}
                  <path d="M18 0V54M36 0V54M0 18H54M0 36H54" stroke="#111827" strokeWidth="2.2" />
                </svg>
                <span className="mode-text">
                  <span className="mode-name">{MODE_LABEL[m.id]}</span>
                  <span className="mode-desc">{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="eyebrow">Players</h2>
          <div className="segmented">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={count === n}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="roster">
            {PLAYER_STYLES.slice(0, count).map((p, i) => (
              <label key={i} className="name-field">
                <Mark d={p.d} color={p.color} />
                <input
                  value={names[i] ?? ''}
                  placeholder={`Player ${i + 1}`}
                  aria-label={`Name for player ${i + 1}`}
                  maxLength={20}
                  onChange={(e) =>
                    setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <div className="rule-blurb">
          <strong>{rule.title}</strong>
          <span>{rule.text}</span>
        </div>
        <div className="start-block">
          <button type="button" className="btn primary big" onClick={() => onStart(config())}>
            Start game
          </button>
          <span className="hint">Pass-and-play on one device</span>
          <button type="button" className="btn big" onClick={() => onPlayOnline(config())}>
            Play online
          </button>
          <span className="hint">
            Host a room and invite friends with a link. Player 1&apos;s name is yours.
          </span>
        </div>
      </div>
    </div>
  );
}
