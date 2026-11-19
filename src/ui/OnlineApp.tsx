import { useMemo } from 'react';
import type { Path } from '../game';
import { useGuestRoom, useHostRoom, type Online } from '../online/peer';
import type { Room } from '../online/protocol';
import { deleteHostRoom, loadHostRoom } from '../online/storage';
import { GameScreen } from './GameScreen';
import { Lobby } from './Lobby';

function leave() {
  location.hash = '';
}

function RoomView({ code, online, isHost }: { code: string; online: Online; isHost: boolean }) {
  const { room, you, status, send } = online;

  if (!room) {
    return (
      <div className="setup">
        <div className="setup-intro">
          <h1>Game {code}</h1>
          <p>{status === 'error' ? 'Could not start a connection.' : 'Connecting…'}</p>
        </div>
        <button type="button" className="btn" onClick={leave}>
          Leave
        </button>
      </div>
    );
  }

  const banner =
    status === 'open'
      ? null
      : status === 'connecting'
        ? 'Connecting…'
        : isHost
          ? 'Reconnecting to the server. Guests cannot reach you until it is back.'
          : 'Reconnecting…';

  if (!room.game) {
    const closeLobby = () => {
      if (isHost) {
        if (!window.confirm('Close this room? Players who joined lose their seats.')) return;
        deleteHostRoom(code);
      }
      leave();
    };
    return (
      <Lobby
        room={room}
        you={you}
        isHost={isHost}
        banner={banner}
        onRename={(name) => send({ t: 'rename', name })}
        onStart={() => send({ t: 'start' })}
        onLeave={closeLobby}
      />
    );
  }

  const leaveGame = () => {
    const playing = room.game?.status.kind === 'playing';
    const warning = isHost
      ? 'Leave this game? Others cannot play while you are away. Reopen the invite link to resume.'
      : 'Leave this game? You can rejoin from the invite link.';
    if (playing && !window.confirm(warning)) return;
    leave();
  };

  return (
    <GameScreen
      state={room.game}
      online={{
        you,
        isHost,
        live: isHost || status === 'open',
        connected: room.seats.map((s) => s?.connected ?? false),
        banner,
      }}
      onPlay={(path: Path) => send({ t: 'move', path })}
      onNewGame={leaveGame}
      onPlayAgain={() => send({ t: 'start' })}
    />
  );
}

function HostRoom({ code, initial }: { code: string; initial: Room }) {
  const online = useHostRoom(code, initial);
  return <RoomView code={code} online={online} isHost />;
}

function GuestRoom({ code }: { code: string }) {
  const online = useGuestRoom(code);
  return <RoomView code={code} online={online} isHost={false} />;
}

export function OnlineApp({ code }: { code: string }) {
  const hosted = useMemo(() => loadHostRoom(code), [code]);
  return hosted ? <HostRoom code={code} initial={hosted} /> : <GuestRoom code={code} />;
}
