import { Modal } from './Modal';

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal titleId="rules-title" onClose={onClose}>
      <h2 id="rules-title" className="modal-title">
        How to play
      </h2>
      <div className="rules">
        <h3>Where you play</h3>
        <p>
          Every move sends the next player. The square you pick inside a small board is the small
          board your opponent must play in next. In Omega the same idea runs across two levels: the
          small board you played in picks the next large board, and the square picks the small
          board inside it.
        </p>
        <h3>Closed boards</h3>
        <p>
          If you are sent to a board that is already won or full, you may play in any open small
          board inside the nearest open board above it. In Omega that means the same large board,
          then anywhere. In Ultimate it means anywhere.
        </p>
        <h3>Winning boards</h3>
        <p>
          Three in a row inside a board wins it. Winning a small board claims its square on the
          next board up, and so on to the top. A won board never changes hands.
        </p>
        <h3>2 players</h3>
        <p>
          Three in a row on the top board wins the game. If the top board fills with no line, it is
          a draw.
        </p>
        <h3>3 or 4 players</h3>
        <p>
          Most boards wins. Each small board you win is 1 point, and the game ends when no move
          remains. Three in a row on a larger board claims it: every small board inside becomes
          yours (9 points for an Omega large board) and other players lose theirs there. Three in a
          row on the top board ends the game at once. Ties share the win.
        </p>
        <p>
          Players take turns in seat order, and the order never changes.
        </p>
      </div>
      <button type="button" className="btn primary" onClick={onClose}>
        Got it
      </button>
    </Modal>
  );
}
