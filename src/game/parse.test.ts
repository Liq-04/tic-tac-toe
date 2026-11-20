import { describe, expect, it } from 'vitest';
import { isBotTurn, newGame, parseGame, play, type GameState } from './index';

function withPlayers(players: unknown[]): unknown {
  const game = newGame({ mode: 'ultimate', players: [{ name: 'A' }, { name: 'B' }] });
  return JSON.parse(JSON.stringify({ ...game, config: { ...game.config, players } }));
}

describe('parseGame', () => {
  it('round-trips a game through JSON', () => {
    const game = play(newGame({ mode: 'omega', players: [{ name: 'A' }, { name: 'B' }] }), [4, 4, 4]);
    expect(parseGame(JSON.parse(JSON.stringify(game)))).toEqual(game);
  });

  it('keeps bot: true on seats above 0', () => {
    const parsed = parseGame(withPlayers([{ name: 'A' }, { name: 'B', bot: true }]));
    expect(parsed?.config.players).toEqual([{ name: 'A' }, { name: 'B', bot: true }]);
  });

  it('drops bot on seat 0, and any value other than exactly true', () => {
    const parsed = parseGame(
      withPlayers([{ name: 'A', bot: true }, { name: 'B', bot: 'yes' }, { name: 'C', bot: 1 }, { name: 'D', bot: false }]),
    );
    expect(parsed?.config.players).toEqual([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]);
  });

  it('returns a copy and leaves the input alone', () => {
    const input = withPlayers([{ name: 'A', bot: true }, { name: 'B', bot: true }]) as GameState;
    const parsed = parseGame(input);
    expect(parsed).not.toBe(input);
    expect(input.config.players[0]).toEqual({ name: 'A', bot: true });
  });

  it('rejects a player list that is not 2 to 4 objects', () => {
    expect(parseGame(withPlayers([{ name: 'A' }]))).toBeNull();
    expect(parseGame(withPlayers([{ name: 'A' }, null]))).toBeNull();
    expect(parseGame(withPlayers('ab' as unknown as unknown[]))).toBeNull();
    expect(parseGame(null)).toBeNull();
  });
});

describe('isBotTurn', () => {
  const start = newGame({ mode: 'ultimate', players: [{ name: 'A' }, { name: 'B', bot: true }] });

  it('is true only while a bot seat is to move in a running game', () => {
    expect(isBotTurn(start)).toBe(false);
    const afterHuman = play(start, [4, 4]);
    expect(isBotTurn(afterHuman)).toBe(true);
    expect(isBotTurn({ ...afterHuman, status: { kind: 'draw' } })).toBe(false);
  });
});
