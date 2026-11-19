# Nested tic-tac-toe

Tic-tac-toe inside tic-tac-toe, for 2 to 4 players on one device (pass-and-play). There are two modes.

- **Ultimate**: a top board of 9 small boards, 81 squares.
- **Omega**: a top board of 9 large boards, each holding 9 small boards, 729 squares.

## Rules in brief

- The square you pick inside a small board is the small board your opponent must play in next. In Omega the small board you played in also picks the next large board.
- If the target board is already won or full, the next player may play in any open small board inside the nearest open board above it. In Ultimate that is anywhere. In Omega it is the same large board, then anywhere.
- Three in a row inside a board wins it, and a won board never changes hands.
- **2 players**: three in a row on the top board wins. A full top board with no line is a draw.
- **3 to 4 players**: most boards wins. Each small board is 1 point. Three in a row on a larger board claims it outright: every small board inside becomes yours (9 points for an Omega large board) and other players lose theirs there. Three in a row on the top board ends the game. Ties share the win. Turn order changes every round on a fixed cycle: everyone moves once per round, and the first player always starts a round.

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # vitest, covers the rules in src/game
npm run build    # typecheck + production build into dist/
npm run preview  # serve the built dist/
```

The rules live in `src/game/` as pure functions over an immutable board tree, with no React imports. The UI in `src/ui/` renders that tree with one recursive `BoardView`. The current game is saved to `localStorage`, so a refresh keeps it.

## Deploy

The build is a static site with relative asset paths (`base: './'`), so `dist/` works on any static host.

- **Vercel**: import the repo. Build command `npm run build`, output directory `dist`.
- **Netlify**: build command `npm run build`, publish directory `dist`.
- **GitHub Pages**: publish the contents of `dist/`.
