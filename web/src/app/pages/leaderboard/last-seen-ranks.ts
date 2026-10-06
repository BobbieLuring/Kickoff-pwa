import { LeaderboardEntry } from './leaderboard-entry';

// One saved ranking per player, so arrows don't mix rooms on the same phone.
const storageKey = (myPlayerId: string) => `kickoff.leaderboard.lastSeen.${myPlayerId}`;

/** Ranks from the last time this phone viewed the leaderboard, keyed by playerId. */
export function loadLastSeenRanks(myPlayerId: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(myPlayerId)) ?? '{}');
  } catch {
    return {};
  }
}

export function saveLastSeenRanks(myPlayerId: string, entries: LeaderboardEntry[]): void {
  try {
    const ranks = Object.fromEntries(entries.map((e) => [e.playerId, e.rank]));
    localStorage.setItem(storageKey(myPlayerId), JSON.stringify(ranks));
  } catch {
    // Storage can be unavailable (private mode); arrows just won't show.
  }
}