import { useEffect, useRef, useState } from 'react';
import { MODE_LABEL, PLAYER_STYLES } from './players';
import type { PlayerId } from '../game';
import type { Room } from '../online/protocol';
import { Mark } from './Mark';

interface Props {
  room: Room;
  you: PlayerId | null;
  isHost: boolean;
  banner: string | null;
  onRename: (name: string) => void;
  onStart: () => void;
  onLeave: () => void;
}

function NameInput({ value, onCommit }: { value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft);
  };

  return (
    <input
      value={draft}
      maxLength={16}
      aria-label="Your name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export function Lobby({ room, you, isHost, banner, onRename, onStart, onLeave }: Props) {
  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}#/g/${room.code}`;
  const full = room.seats.every((s) => s !== null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      linkRef.current?.select();
    }
  };

  return (
    <div className="setup">
      <div className="setup-intro">
        <h1>Game {room.code}</h1>
        <p>
          {MODE_LABEL[room.mode]} · {room.seats.length} players
        </p>
      </div>
      <div className="setup-card">
        {banner && (
          <div className="banner" role="status">
            {banner}
          </div>
        )}
        {you === null ? (
          <div className="rule-blurb">
            <strong>This game is full</strong>
            <span>Every seat is taken. Ask the host for a new link.</span>
          </div>
        ) : (
          <section>
            <h2 className="eyebrow">Invite friends</h2>
            <div className="invite">
              <input
                ref={linkRef}
                readOnly
                value={link}
                aria-label="Invite link"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn" onClick={copy}>
                {copied ? 'Copied' : 'Copy invite link'}
              </button>
            </div>
          </section>
        )}
        <section>
          <h2 className="eyebrow">Players</h2>
          <ul className="seat-list">
            {room.seats.map((seat, i) => {
              const style = PLAYER_STYLES[i];
              const mine = i === you;
              return (
                <li key={i} className="seat">
                  {style && <Mark d={style.d} color={style.color} />}
                  {seat === null ? (
                    <span className="seat-empty">waiting…</span>
                  ) : mine ? (
                    <NameInput value={seat.name} onCommit={onRename} />
                  ) : (
                    <span className="seat-name">{seat.name}</span>
                  )}
                  {mine && <span className="seat-tag">You</span>}
                  {i === 0 && <span className="seat-tag">Host</span>}
                  {seat && (
                    <span
                      className={`dot${seat.connected ? ' on' : ''}`}
                      role="img"
                      aria-label={seat.connected ? 'connected' : 'disconnected'}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <div className="start-block">
          {isHost ? (
            <button type="button" className="btn primary big" disabled={!full} onClick={onStart}>
              Start game
            </button>
          ) : (
            you !== null && <span className="hint">Waiting for host to start</span>
          )}
          <button type="button" className="btn big" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
