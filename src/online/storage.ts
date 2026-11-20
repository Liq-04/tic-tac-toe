import type { Config } from '../game';
import { createRoom, newCode, newToken, parseRoom, type Room, type Token } from './protocol';

const hostKey = (code: string) => `nested-ttt:host:${code}`;
const guestKey = (code: string) => `nested-ttt:guest:${code}`;

export interface GuestIdentity {
  token: Token;
  name: string;
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota); the room still works until the tab closes.
  }
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const saveHostRoom = (room: Room) => write(hostKey(room.code), room);
export const deleteHostRoom = (code: string) => write(hostKey(code), null);

/** A stored room means this browser hosts it. Guests must say hello again, so they start offline. */
export function loadHostRoom(code: string): Room | null {
  const room = parseRoom(read(hostKey(code)));
  if (!room || room.code !== code || !room.seats[0]) return null;
  const seats = room.seats.map((s, i) => (s && i > 0 ? { ...s, connected: false } : s));
  return { ...room, seats };
}

export function loadGuest(code: string): GuestIdentity {
  const value = read(guestKey(code)) as Partial<GuestIdentity> | null;
  if (typeof value?.token === 'string' && typeof value.name === 'string') {
    return { token: value.token, name: value.name };
  }
  return { token: newToken(), name: '' };
}

export const saveGuest = (code: string, identity: GuestIdentity) =>
  write(guestKey(code), identity);

/** Creates and stores a lobby for this browser to host; returns its invite code. */
export function createHostedRoom(config: Config): string {
  const code = newCode();
  const players = config.players.length as 2 | 3 | 4;
  const name = config.players[0]?.name ?? '';
  saveHostRoom(createRoom(code, config.mode, players, { token: newToken(), name }));
  return code;
}
