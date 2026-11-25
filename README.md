# Nested tic-tac-toe

Tic-tac-toe inside tic-tac-toe, for 2 to 4 players, on one device (pass-and-play) or online with friends. There are two modes.

- **Ultimate**: a top board of 9 small boards, 81 squares.
- **Omega**: a top board of 9 large boards, each holding 9 small boards, 729 squares.

## Rules in brief

- The square you pick inside a small board is the small board your opponent must play in next. In Omega the small board you played in also picks the next large board.
- If the target board is already won or full, the next player may play in any open small board inside the nearest open board above it. In Ultimate that is anywhere. In Omega it is the same large board, then anywhere.
- Three in a row inside a board wins it, and a won board never changes hands.
- **2 players**: three in a row on the top board wins. A full top board with no line is a draw.
- **3 to 4 players**: most boards wins. Each small board is 1 point. Three in a row on a larger board claims it outright: every small board inside becomes yours (9 points for an Omega large board) and other players lose theirs there. Three in a row on the top board ends the game. Ties share the win. Players take turns in seat order, and the order never changes.

## Bots

On the setup screen, set any seat after player 1 to **Bot** to play against the computer, in either mode and for 2 to 4 players. Player 1 is always human. A bot is a Monte Carlo tree search that thinks for about a second per move in a Web Worker, so the page stays responsive. Bots work offline only: **Play online** is disabled while a seat is a bot.

## Win chances

When a game ends, the result screen shows each player's chance of winning at the start and after every round. The bot's search plays out the rest of the game from each of those positions, 25,000 times in Ultimate and 1,000 in Omega, and the chance is the average share of the win. A shared win counts as a fraction, and whatever is left over is the chance of a draw. The numbers assume every player plays like the bot. Games that started before moves were recorded have no chart and no replay. The numbers take about 10 seconds to work out for an Ultimate game and about 30 for a long Omega game, and fill in as they arrive.

## Replay

Press **Watch replay** on the result screen to play the game back with each player's chance of winning beside the board. Use the buttons, the slider, the chart, the key moves list, or the arrow keys and Space. The replay marks three kinds of move:

- **Blunder (??)**: the player's own chance fell, and another move would have left it at least 10 points higher.
- **Missed chance (?)**: the player's chance stayed about the same, and another move would have left it at least 10 points higher.
- **Great move (!!)**: the move left the player's chance at least 10 points higher than the next best move would have. The move that ends the game does not count.

For a blunder or a missed chance, the better move is outlined in green on the board. A move that lowers a player's chance is not a blunder when every other move would have lowered it too.

## Online play

Press **Play online** on the setup screen to host a room. You get a five-character code and an invite link (`#/g/<code>`). Friends open the link, take a seat in the lobby, and the host starts the game.

- Connections are peer-to-peer through [PeerJS](https://peerjs.com). The host's browser holds the game and checks every move. There is no game server and no account. The free public PeerJS cloud only introduces the browsers to each other.
- The host must keep their tab open. If it closes, play pauses. Reopening the invite link in the same browser resumes the room, and guests reconnect on their own.
- Guests who reload or lose connection get their seat back, because each browser keeps a private token per room in `localStorage`.
- Some strict networks (corporate firewalls, some mobile carriers) block direct connections, because the app has no relay server. Switching one player to another network usually fixes it.

To test against a local signaling server instead of the public cloud:

```sh
npm run peer                                            # starts a PeerJS server on :9000
VITE_PEER_SERVER=localhost:9000 npm run build && npm run preview
```

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # vitest, covers the rules in src/game and the bot in src/bot
npm run build    # typecheck + production build into dist/
npm run preview  # serve the built dist/
```

The rules live in `src/game/` as pure functions over an immutable board tree, with no React imports. The UI in `src/ui/` renders that tree with one recursive `BoardView`. The current game is saved to `localStorage`, so a refresh keeps it.

## Deploy

The build is a static site with relative asset paths (`base: './'`), so `dist/` works on any static host.

- **Vercel**: import the repo. Build command `npm run build`, output directory `dist`.
- **Netlify**: build command `npm run build`, publish directory `dist`.
- **GitHub Pages**: `.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main`. One-time setup: in the repository go to Settings, Pages, and set Source to **GitHub Actions**. The site then lives at `https://<user>.github.io/tic-tac-toe/`. Run the workflow by hand from the Actions tab with **Run workflow**.
