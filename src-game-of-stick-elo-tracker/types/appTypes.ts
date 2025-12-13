export interface Player {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  previousRank: number; // 0 if new or unranked
  currentStreakType: 'W' | 'L' | null; // 'W' for win, 'L' for loss, null for no streak
  currentStreakLength: number; // Length of the current streak
  lastEloChange?: number; // Optional: Stores the last ELO change for display
  previousElo?: number; // Optional: Stores the previous ELO for diff logic
}

export interface Match {
  id: string;
  timestamp: number;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  player1EloBefore: number;
  player2EloBefore: number;
  player1EloAfter: number;
  player2EloAfter: number;
  outcome: 'p1' | 'p2' | 'draw';
  player1EloChange?: number; // Optional: Stores ELO change for Player 1
  player2EloChange?: number; // Optional: Stores ELO change for Player 2
}

export interface GameSessionMetadata {
  id: string;
  name: string;
  createdAt: number;
  lastPlayed: number;
  playerCount: number;
  kFactor: number;
}
