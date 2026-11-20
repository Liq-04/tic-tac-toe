import { describe, expect, it } from 'vitest';
import { nodeAt } from '../game';
import {
  createRoom,
  forGuest,
  hostReduce,
  parseRoom,
  parseToGuest,
  parseToHost,
  seatOf,
  type Room,
} from './protocol';

const HOST = 'host-token';

function lobby(players: 2 | 3 | 4 = 2, mode: 'ultimate' | 'omega' = 'ultimate'): Room {
  return createRoom('ABCDE', mode, players, { token: HOST, name: 'Hana' });
}

function join(room: Room, token: string, name = ''): Room {
  return hostReduce(room, token, { t: 'hello', token, name });
}

function full(players: 2 | 3 | 4 = 2): Room {
  let room = lobby(players);
  for (let i = 1; i < players; i++) room = join(room, `guest-${i}`, `Guest ${i}`);
  return room;
}

function started(players: 2 | 3 | 4 = 2): Room {
  return hostReduce(full(players), HOST, { t: 'start' });
}

function names(room: Room): (string | undefined)[] {
  return room.seats.map((s) => s?.name);
}

function move(room: Room, token: string, ...path: number[]): Room {
  return hostReduce(room, token, { t: 'move', path });
}

describe('createRoom', () => {
  it('seats the host in seat 0 and leaves the rest open', () => {
    const room = lobby(3);
    expect(room.seats).toEqual([{ token: HOST, name: 'Hana', connected: true }, null, null]);
    expect(room.game).toBeNull();
  });

  it('names a blank host Player 1', () => {
    expect(createRoom('ABCDE', 'omega', 2, { token: HOST, name: '  ' }).seats[0]?.name).toBe(
      'Player 1',
    );
  });
});

describe('hello', () => {
  it('fills the lowest free seat', () => {
    let room = lobby(4);
    room = join(room, 'a', 'Ann');
    room = join(room, 'b', 'Bo');
    expect(names(room)).toEqual(['Hana', 'Ann', 'Bo', undefined]);
    expect(seatOf(room, 'b')).toBe(2);
  });

  it('gives a rejoining token its old seat without moving anyone', () => {
    let room = join(join(lobby(3), 'a', 'Ann'), 'b', 'Bo');
    room = hostReduce(room, 'a', { t: 'disconnect' });
    room = join(room, 'a', 'Ann');
    expect(seatOf(room, 'a')).toBe(1);
    expect(seatOf(room, 'b')).toBe(2);
    expect(room.seats[1]?.connected).toBe(true);
  });

  it('lets a seated token rejoin mid-game and updates its name', () => {
    let room = hostReduce(started(), 'guest-1', { t: 'disconnect' });
    room = join(room, 'guest-1', 'Guest One');
    expect(room.seats[1]).toEqual({ token: 'guest-1', name: 'Guest One', connected: true });
  });

  it('leaves the room alone when a connected seat repeats an unchanged hello', () => {
    const room = join(lobby(), 'a', 'Ann');
    expect(join(room, 'a', 'Ann')).toBe(room);
  });

  it('turns away a newcomer when the room is full', () => {
    const room = full(2);
    expect(join(room, 'late', 'Late')).toBe(room);
    expect(seatOf(room, 'late')).toBeNull();
  });

  it('turns away a newcomer once the game has started', () => {
    const room = started(2);
    const withFreeSeat: Room = { ...room, seats: [room.seats[0] ?? null, null] };
    expect(join(withFreeSeat, 'late')).toBe(withFreeSeat);
  });

  it('defaults a blank joiner name to their seat number', () => {
    expect(join(lobby(3), 'a', '').seats[1]?.name).toBe('Player 2');
  });
});

describe('rename', () => {
  it('trims and truncates to 16 characters', () => {
    const room = join(lobby(), 'a');
    const renamed = hostReduce(room, 'a', { t: 'rename', name: `  ${'x'.repeat(30)}  ` });
    expect(renamed.seats[1]?.name).toBe('x'.repeat(16));
  });

  it('falls back to Player N when emptied', () => {
    const room = join(lobby(), 'a', 'Ann');
    expect(hostReduce(room, 'a', { t: 'rename', name: '   ' }).seats[1]?.name).toBe('Player 2');
  });

  it('ignores unseated tokens and games in progress', () => {
    const lob = join(lobby(), 'a');
    expect(hostReduce(lob, 'stranger', { t: 'rename', name: 'Eve' })).toBe(lob);
    const playing = started();
    expect(hostReduce(playing, HOST, { t: 'rename', name: 'Eve' })).toBe(playing);
  });
});

describe('start', () => {
  it('begins a game with the seated names in seat order', () => {
    const room = started(3);
    expect(room.game?.config.players.map((p) => p.name)).toEqual(['Hana', 'Guest 1', 'Guest 2']);
    expect(room.game?.config.mode).toBe('ultimate');
    expect(room.game?.turn).toBe(0);
  });

  it('is refused from a guest', () => {
    const room = full();
    expect(hostReduce(room, 'guest-1', { t: 'start' })).toBe(room);
  });

  it('is refused until every seat is filled', () => {
    const room = join(lobby(3), 'a');
    expect(hostReduce(room, HOST, { t: 'start' })).toBe(room);
  });

  it('is refused while a game is in progress', () => {
    const room = started();
    expect(hostReduce(room, HOST, { t: 'start' })).toBe(room);
  });

  it('plays again with the same seats and a fresh board after the game ends', () => {
    const base = started();
    const finished: Room = {
      ...base,
      game: { ...base.game!, status: { kind: 'won', winners: [1] } },
    };
    const again = hostReduce(finished, HOST, { t: 'start' });
    expect(again.seats).toBe(finished.seats);
    expect(again.game?.status).toEqual({ kind: 'playing' });
    expect(again.game?.lastMove).toBeNull();
    expect(again.game?.config.players.map((p) => p.name)).toEqual(['Hana', 'Guest 1']);
  });
});

describe('move', () => {
  it('applies the move of the player whose turn it is', () => {
    const room = move(started(), HOST, 4, 4);
    expect(nodeAt(room.game!.root, [4, 4])).toEqual({ kind: 'cell', mark: 0 });
    expect(room.game?.turn).toBe(1);
  });

  it('ignores a move out of turn', () => {
    const room = started();
    expect(move(room, 'guest-1', 4, 4)).toBe(room);
  });

  it('ignores a move from a spectator or before the game starts', () => {
    const playing = started();
    expect(move(playing, 'stranger', 4, 4)).toBe(playing);
    const lob = full();
    expect(move(lob, HOST, 4, 4)).toBe(lob);
  });

  it('ignores illegal paths from the right player', () => {
    const afterFirst = move(started(), HOST, 4, 4);
    expect(move(afterFirst, 'guest-1', 4, 4)).toBe(afterFirst);
    expect(move(afterFirst, 'guest-1', 0, 0)).toBe(afterFirst);
    expect(move(afterFirst, 'guest-1', 4)).toBe(afterFirst);
  });

  it('honours the target-board rule across turns', () => {
    let room = move(started(), HOST, 4, 4);
    room = move(room, 'guest-1', 4, 0);
    expect(room.game?.zone).toEqual([0]);
    expect(room.game?.turn).toBe(0);
    expect(move(room, HOST, 1, 1)).toBe(room);
    expect(move(room, HOST, 0, 3).game?.turn).toBe(1);
  });

  it('follows the 3-player turn order', () => {
    let room = started(3);
    room = move(room, HOST, 4, 4);
    room = move(room, 'guest-1', 4, 0);
    room = move(room, 'guest-2', 0, 0);
    expect(room.game?.turn).toBe(0);
  });
});

describe('disconnect', () => {
  it('keeps the seat reserved and marks it offline', () => {
    const room = hostReduce(full(), 'guest-1', { t: 'disconnect' });
    expect(room.seats[1]).toEqual({ token: 'guest-1', name: 'Guest 1', connected: false });
    expect(join(room, 'late')).toBe(room);
  });

  it('is a no-op for unknown tokens and already-offline seats', () => {
    const room = full();
    expect(hostReduce(room, 'stranger', { t: 'disconnect' })).toBe(room);
    const off = hostReduce(room, 'guest-1', { t: 'disconnect' });
    expect(hostReduce(off, 'guest-1', { t: 'disconnect' })).toBe(off);
  });
});

describe('wire parsing', () => {
  it('accepts well-formed host messages and drops junk', () => {
    expect(parseToHost({ t: 'move', path: [1, 2] })).toEqual({ t: 'move', path: [1, 2] });
    expect(parseToHost({ t: 'hello', token: 'x', name: 'N' })).toEqual({
      t: 'hello',
      token: 'x',
      name: 'N',
    });
    expect(parseToHost({ t: 'move', path: ['1'] })).toBeNull();
    expect(parseToHost({ t: 'start' })).toBeNull();
    expect(parseToHost('hi')).toBeNull();
    expect(parseToHost(null)).toBeNull();
  });

  it('round-trips a room through JSON, including a running game', () => {
    const room = move(started(3), HOST, 4, 4);
    const wire: unknown = JSON.parse(JSON.stringify({ t: 'room', room, you: 2 }));
    expect(parseToGuest(wire)).toEqual({ t: 'room', room, you: 2 });
    const omega = lobby(4);
    expect(parseRoom(JSON.parse(JSON.stringify(omega)))).toEqual(omega);
  });

  it('rejects malformed rooms', () => {
    expect(parseRoom({ code: 'A', mode: 'ultimate', seats: [null], game: null })).toBeNull();
    expect(parseRoom({ code: 'A', mode: 'x', seats: [null, null], game: null })).toBeNull();
    expect(parseToGuest({ t: 'room', room: lobby(), you: 9 })).toBeNull();
    expect(parseToGuest({ t: 'other' })).toBeNull();
  });
});

describe('forGuest', () => {
  it('tells each guest their own seat without revealing anyone\'s token', () => {
    const room = full(3);
    const view = forGuest(room, 'guest-2');
    expect(view.you).toBe(2);
    expect(JSON.stringify(view)).not.toMatch(/host-token|guest-1|guest-2/);
    expect(names(view.room)).toEqual(names(room));
  });

  it('a guest cannot take over a seat using what the host sent them', () => {
    const room = started(2);
    const leaked = forGuest(room, 'guest-1').room.seats[0]!.token;
    const hijack = hostReduce(room, leaked, { t: 'hello', token: leaked, name: 'x' });
    expect(seatOf(hijack, leaked)).toBeNull();
    expect(move(hijack, leaked, 0, 0)).toBe(hijack);
  });
});
