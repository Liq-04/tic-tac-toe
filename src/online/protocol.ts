import { newGame, parseGame, play, type GameState, type Mode, type Path, type PlayerId } from '../game';

export type Token = string;

export interface Seat {
  token: Token;
  name: string;
  connected: boolean;
}

export interface Room {
  code: string;
  mode: Mode;
  /** Seat i plays PlayerId i. The host is seat 0. */
  seats: readonly (Seat | null)[];
  /** null while the room is still a lobby. */
  game: GameState | null;
}

export type ToHost =
  | { t: 'hello'; token: Token; name: string }
  | { t: 'rename'; name: string }
  | { t: 'move'; path: Path };

export type ToGuest = { t: 'room'; room: Room; you: PlayerId | null };

export type HostInput = ToHost | { t: 'start' } | { t: 'disconnect' };

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_NAME = 16;

export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function newToken(): Token {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export function parseCode(value: string): string | null {
  const code = value.toUpperCase();
  const valid = code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
  return valid ? code : null;
}

export function peerIdOf(code: string): string {
  return `nested-ttt-${code}`;
}

function cleanName(name: string, seat: number): string {
  return name.trim().slice(0, MAX_NAME) || `Player ${seat + 1}`;
}

export function seatOf(room: Room, token: Token): PlayerId | null {
  const i = room.seats.findIndex((s) => s?.token === token);
  return i < 0 ? null : (i as PlayerId);
}

export function createRoom(
  code: string,
  mode: Mode,
  players: 2 | 3 | 4,
  host: { token: Token; name: string },
): Room {
  const seats: (Seat | null)[] = Array.from({ length: players }, () => null);
  seats[0] = { token: host.token, name: cleanName(host.name, 0), connected: true };
  return { code, mode, seats, game: null };
}

function withSeat(room: Room, index: number, seat: Seat): Room {
  return { ...room, seats: room.seats.map((s, i) => (i === index ? seat : s)) };
}

function hello(room: Room, msg: Extract<ToHost, { t: 'hello' }>): Room {
  const existing = seatOf(room, msg.token);
  if (existing !== null) {
    const seat = room.seats[existing]!;
    const name = cleanName(msg.name, existing);
    if (seat.connected && seat.name === name) return room;
    return withSeat(room, existing, { ...seat, name, connected: true });
  }
  const free = room.seats.indexOf(null);
  if (room.game || free < 0) return room;
  return withSeat(room, free, {
    token: msg.token,
    name: cleanName(msg.name, free),
    connected: true,
  });
}

/** Returns the same reference when the message changes nothing, so callers can skip broadcasting. */
export function hostReduce(room: Room, from: Token, msg: HostInput): Room {
  const seat = seatOf(room, from);
  switch (msg.t) {
    case 'hello':
      return hello(room, msg);
    case 'rename': {
      if (room.game || seat === null) return room;
      const name = cleanName(msg.name, seat);
      const current = room.seats[seat]!;
      return current.name === name ? room : withSeat(room, seat, { ...current, name });
    }
    case 'start': {
      const inLobbyOrOver = !room.game || room.game.status.kind !== 'playing';
      const full = room.seats.every((s) => s !== null);
      if (seat !== 0 || !inLobbyOrOver || !full) return room;
      const players = room.seats.map((s) => ({ name: s!.name }));
      return { ...room, game: newGame({ mode: room.mode, players }) };
    }
    case 'move': {
      if (!room.game || seat === null || room.game.turn !== seat) return room;
      const game = play(room.game, msg.path);
      return game === room.game ? room : { ...room, game };
    }
    case 'disconnect': {
      const current = seat === null ? null : room.seats[seat]!;
      return seat === null || !current?.connected
        ? room
        : withSeat(room, seat, { ...current, connected: false });
    }
  }
}

/** A guest's view of the room. Tokens are the only proof of a seat, so they never leave the host. */
export function forGuest(room: Room, token: Token): ToGuest {
  const seats = room.seats.map((s) => s && { ...s, token: '' });
  return { t: 'room', room: { ...room, seats }, you: seatOf(room, token) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseToHost(value: unknown): ToHost | null {
  if (!isRecord(value)) return null;
  switch (value.t) {
    case 'hello':
      return typeof value.token === 'string' && value.token && typeof value.name === 'string'
        ? { t: 'hello', token: value.token, name: value.name }
        : null;
    case 'rename':
      return typeof value.name === 'string' ? { t: 'rename', name: value.name } : null;
    case 'move':
      return Array.isArray(value.path) && value.path.every((d) => typeof d === 'number')
        ? { t: 'move', path: value.path as number[] }
        : null;
    default:
      return null;
  }
}

function parseSeat(value: unknown): Seat | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { token, name, connected } = value;
  if (typeof token !== 'string' || typeof name !== 'string' || typeof connected !== 'boolean') {
    return undefined;
  }
  return { token, name, connected };
}

export function parseRoom(value: unknown): Room | null {
  if (!isRecord(value) || typeof value.code !== 'string' || !Array.isArray(value.seats)) {
    return null;
  }
  const { mode } = value;
  if (mode !== 'ultimate' && mode !== 'omega') return null;
  const seats = value.seats.map(parseSeat);
  if (seats.length < 2 || seats.length > 4 || seats.includes(undefined)) return null;
  const game = value.game === null ? null : parseGame(value.game);
  if (value.game !== null && !game) return null;
  return { code: value.code, mode, seats: seats as (Seat | null)[], game };
}

export function parseToGuest(value: unknown): ToGuest | null {
  if (!isRecord(value) || value.t !== 'room') return null;
  const room = parseRoom(value.room);
  const { you } = value;
  const validYou = you === null || (typeof you === 'number' && you >= 0 && you <= 3);
  return room && validYou ? { t: 'room', room, you: you as PlayerId | null } : null;
}
