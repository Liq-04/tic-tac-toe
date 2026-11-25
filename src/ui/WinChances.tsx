import { useState } from 'react';
import type { PlayerInfo } from '../game';
import { ChancesChart, ChancesLegend, canDraw, drawChance, percent } from './ChancesChart';
import type { Review } from './useGameReview';

type Plies = Extract<Review, { kind: 'plies' }>;

function roundLabel(round: number, rounds: number): string {
  if (round === 0) return 'Start of the game';
  return round === rounds ? 'Final result' : `After round ${round} of ${rounds}`;
}

function Chart({ players, review: { plies, moves } }: { players: readonly PlayerInfo[]; review: Plies }) {
  const [picked, setPicked] = useState<number | null>(null);
  const rounds = Math.ceil(moves / players.length);
  const steps = plies
    .filter(({ ply }) => ply % players.length === 0 || ply === moves)
    .map(({ chances }) => chances);
  const last = steps.length - 1;
  const at = Math.min(picked ?? last, last);
  const shown = steps[at];
  const withDraw = canDraw(steps);

  return (
    <>
      <p className="chances-round">{shown ? roundLabel(at, rounds) : 'Calculating…'}</p>
      <ChancesLegend players={players} shown={shown} withDraw={withDraw} />
      <ChancesChart
        players={players}
        steps={steps}
        last={rounds}
        at={at}
        onPick={setPicked}
        stepName="Round"
        stepLabel={(round) => roundLabel(round, rounds)}
        pickOnHover
        endLabel={rounds === 1 ? '1 round' : `${rounds} rounds`}
      />
      <details className="chances-table">
        <summary>Show as a table</summary>
        <div>
          <table>
            <thead>
              <tr>
                <th scope="col">Round</th>
                {players.map((p, i) => (
                  <th key={i} scope="col">
                    {p.name}
                  </th>
                ))}
                {withDraw && <th scope="col">Draw</th>}
              </tr>
            </thead>
            <tbody>
              {steps.map((chances, round) => (
                <tr key={round}>
                  <th scope="row">{round === 0 ? 'Start' : round === rounds ? 'Result' : round}</th>
                  {chances.map((chance, i) => (
                    <td key={i}>{percent(chance)}</td>
                  ))}
                  {withDraw && <td>{percent(drawChance(chances))}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function reviewNote(review: Review): string {
  switch (review.kind) {
    case 'unavailable':
      return 'Not available, because this game started before moves were recorded.';
    case 'failed':
      return 'Could not be calculated for this game.';
    case 'plies': {
      const { plies, moves } = review;
      return plies.length <= moves
        ? `Calculating… ${plies.length} of ${moves + 1}`
        : 'Estimated by the bot, which plays out the rest of the game many times from each point.';
    }
    default: {
      const _exhaustive: never = review;
      return _exhaustive;
    }
  }
}

export function WinChances({ players, review }: { players: readonly PlayerInfo[]; review: Review }) {
  return (
    <section className="chances" aria-labelledby="chances-title">
      <h3 id="chances-title">Win chances by round</h3>
      {review.kind === 'plies' && <Chart players={players} review={review} />}
      <p className="hint">{reviewNote(review)}</p>
    </section>
  );
}
