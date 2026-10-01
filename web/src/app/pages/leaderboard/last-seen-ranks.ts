import { LeaderboardEntry } from './leaderboard-entry';

const STORAGE_KEY = 'kickoff.leaderboard.lastSeen';

/** Ranks from the last time this phone viewed the leaderboard, keyed by playerId. */
export function loadLastSeenRanks(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveLastSeenRanks(entries: LeaderboardEntry[]): void {
  try {
    const ranks = Object.fromEntries(entries.map((e) => [e.playerId, e.rank]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ranks));
  } catch {
    // Storage can be unavailable (private mode); arrows just won't show.
  }
}