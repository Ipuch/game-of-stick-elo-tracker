export function calculateElo(
  p1Elo: number,
  p2Elo: number,
  winner: 'p1' | 'p2' | 'draw',
  kFactor: number
): { newP1Elo: number; newP2Elo: number } {
  const expectedScoreP1 = 1 / (1 + 10 ** ((p2Elo - p1Elo) / 400));
  const expectedScoreP2 = 1 / (1 + 10 ** ((p1Elo - p2Elo) / 400));

  let actualScoreP1: number, actualScoreP2: number;

  if (winner === 'p1') {
    actualScoreP1 = 1;
    actualScoreP2 = 0;
  } else if (winner === 'p2') {
    actualScoreP1 = 0;
    actualScoreP2 = 1;
  } else { // Draw
    actualScoreP1 = 0.5;
    actualScoreP2 = 0.5;
  }

  const newP1Elo = Math.round(p1Elo + kFactor * (actualScoreP1 - expectedScoreP1));
  const newP2Elo = Math.round(p2Elo + kFactor * (actualScoreP2 - expectedScoreP2));

  return { newP1Elo, newP2Elo };
} 