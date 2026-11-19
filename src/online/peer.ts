import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerId } from '../game';
import {
  forGuest,
  hostReduce,
  parseToGuest,
  parseToHost,
  peerIdOf,
  type HostInput,
  type Room,
  type ToHost,
  type Token,
} from './protocol';
import { loadGuest, saveGuest, saveHostRoom } from './storage';

export type Status = 'connecting' | 'open' | 'reconnecting' | 'error';

export interface Online {
  room: Room | null;
  you: PlayerId | null;
  status: Status;
  send: (msg: ToHost | { t: 'start' }) => void;
}

const HOST_RETRY_MS = 2000;
const CONNECT_TIMEOUT_MS = 15000;
const BACKOFF_MS = [1000, 2000, 4000, 5000];
const PING_MS = 2000;
const SILENT_MS = 10000;

/** WebRTC rarely reports a peer that vanished (closed tab, lost network), so both sides ping and drop silent links. */
function keepAlive(conn: DataConnection) {
  let seen = Date.now();
  conn.on('data', () => {
    seen = Date.now();
  });
  const timer = setInterval(() => {
    if (Date.now() - seen > SILENT_MS) conn.close();
    else if (conn.open) conn.send({ t: 'ping' });
  }, PING_MS);
  conn.on('close', () => clearInterval(timer));
}

/** Public PeerJS cloud unless VITE_PEER_SERVER=host:port points at a local signaling server. */
function peerOptions(): PeerOptions {
  const server: unknown = import.meta.env.VITE_PEER_SERVER;
  if (typeof server !== 'string' || !server) return {};
  const [host = '', port = ''] = server.split(':');
  return { host, port: Number(port) || 9000, path: '/', secure: false };
}

export function useHostRoom(code: string, initial: Room): Online {
  const [room, setRoom] = useState(initial);
  const [status, setStatus] = useState<Status>('connecting');
  const sendRef = useRef<Online['send']>(() => {});
  const roomRef = useRef(initial);
  const send = useCallback<Online['send']>((msg) => sendRef.current(msg), []);

  useEffect(() => {
    const hostToken = roomRef.current.seats[0]?.token ?? '';
    const conns = new Map<DataConnection, Token | null>();
    let peer: Peer | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const reply = (conn: DataConnection, current: Room) => {
      const token = conns.get(conn);
      if (!token || !conn.open) return;
      conn.send(forGuest(current, token));
    };

    const apply = (from: Token, msg: HostInput, origin?: DataConnection) => {
      const prev = roomRef.current;
      const next = hostReduce(prev, from, msg);
      if (next === prev) {
        if (origin && msg.t === 'hello') reply(origin, next);
        return;
      }
      roomRef.current = next;
      saveHostRoom(next);
      setRoom(next);
      for (const conn of conns.keys()) reply(conn, next);
    };
    sendRef.current = (msg) => apply(hostToken, msg);

    const accept = (conn: DataConnection) => {
      conns.set(conn, null);
      keepAlive(conn);
      conn.on('data', (data) => {
        const msg = parseToHost(data);
        if (!msg) return;
        const known = conns.get(conn);
        if (msg.t === 'hello') {
          if (known && known !== msg.token) return;
          conns.set(conn, msg.token);
          for (const [other, token] of conns) {
            if (other !== conn && token === msg.token) other.close();
          }
          apply(msg.token, msg, conn);
        } else if (known) {
          apply(known, msg);
        }
      });
      conn.on('close', () => {
        const token = conns.get(conn);
        conns.delete(conn);
        // A rejoin opens a new connection before the stale one closes.
        if (token && ![...conns.values()].includes(token)) apply(token, { t: 'disconnect' });
      });
      conn.on('error', () => conn.close());
    };

    const register = () => {
      if (disposed) return;
      const current = new Peer(peerIdOf(code), peerOptions());
      peer = current;
      current.on('open', () => setStatus('open'));
      current.on('connection', accept);
      current.on('disconnected', () => {
        if (peer !== current || current.destroyed) return;
        setStatus('reconnecting');
        current.reconnect();
      });
      current.on('error', (err) => {
        if (peer !== current) return;
        // The id stays taken until the signaling server drops our previous session.
        setStatus(err.type === 'unavailable-id' ? 'connecting' : 'reconnecting');
        current.destroy();
        peer = null;
        retry = setTimeout(register, HOST_RETRY_MS);
      });
    };
    register();

    return () => {
      disposed = true;
      clearTimeout(retry);
      peer?.destroy();
      sendRef.current = () => {};
    };
  }, [code]);

  return { room, you: 0, status, send };
}

export function useGuestRoom(code: string): Online {
  const [snapshot, setSnapshot] = useState<{ room: Room; you: PlayerId | null } | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const connRef = useRef<DataConnection | null>(null);
  const send = useCallback<Online['send']>((msg) => {
    if (connRef.current?.open) connRef.current.send(msg);
  }, []);

  useEffect(() => {
    const identity = loadGuest(code);
    let peer: Peer | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    let attempt = 0;
    let disposed = false;

    const teardown = () => {
      clearTimeout(timer);
      connRef.current = null;
      peer?.destroy();
      peer = null;
    };

    const connect = () => {
      if (disposed) return;
      teardown();
      const mine = ++generation;
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');

      const fail = () => {
        if (disposed || mine !== generation) return;
        generation++;
        teardown();
        setStatus('reconnecting');
        timer = setTimeout(connect, BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
        attempt++;
      };

      let current: Peer;
      try {
        current = new Peer(peerOptions());
      } catch {
        setStatus('error');
        return;
      }
      peer = current;
      current.on('error', fail);
      current.on('open', () => {
        const conn = current.connect(peerIdOf(code), { serialization: 'json', reliable: true });
        connRef.current = conn;
        keepAlive(conn);
        timer = setTimeout(fail, CONNECT_TIMEOUT_MS);
        conn.on('open', () => {
          clearTimeout(timer);
          attempt = 0;
          setStatus('open');
          conn.send({ t: 'hello', token: identity.token, name: identity.name });
        });
        conn.on('data', (data) => {
          const msg = parseToGuest(data);
          if (!msg) return;
          setSnapshot({ room: msg.room, you: msg.you });
          const seat = msg.you === null ? null : msg.room.seats[msg.you];
          if (seat) {
            identity.name = seat.name;
            saveGuest(code, identity);
          }
        });
        conn.on('close', fail);
        conn.on('error', fail);
      });
    };
    connect();

    return () => {
      disposed = true;
      teardown();
    };
  }, [code]);

  return { room: snapshot?.room ?? null, you: snapshot?.you ?? null, status, send };
}
