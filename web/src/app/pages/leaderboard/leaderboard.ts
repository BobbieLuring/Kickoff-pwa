import { Component, computed, effect, signal } from '@angular/core';
import { LeaderboardEntry } from './leaderboard-entry';
import { loadLastSeenRanks, saveLastSeenRanks } from './last-seen-ranks';

@Component({
  imports: [],
  selector: 'app-leaderboard',
  styleUrl: './leaderboard.scss',
  templateUrl: './leaderboard.html',
})
export class Leaderboard {
  // Fake data until scores exist in Supabase.
  protected readonly myPlayerId = 'p3';

  protected readonly entries = signal<LeaderboardEntry[]>([
    { playerId: 'p1', name: 'Anna', points: 140, rank: 1 },
    { playerId: 'p2', name: 'Johan', points: 131, rank: 2 },
    { playerId: 'p3', name: 'Robert', points: 128, rank: 3 },
    { playerId: 'p4', name: 'Sara', points: 117, rank: 4 },
    { playerId: 'p5', name: 'Erik', points: 104, rank: 5 },
    { playerId: 'p6', name: 'Lina', points: 98, rank: 6 },
    { playerId: 'p7', name: 'Oskar', points: 85, rank: 7 },
    { playerId: 'p8', name: 'Maja', points: 72, rank: 8 },
  ]);

  // Ranks from the previous visit. Read once, so arrows stay put during this visit.
  private readonly baseline = loadLastSeenRanks();

  protected readonly rows = computed(() =>
    this.entries().map((entry) => ({ ...entry, change: this.rankChange(entry) })),
  );

  constructor() {
    // Whatever is shown now becomes the baseline for the next visit.
    effect(() => saveLastSeenRanks(this.entries()));
  }

  /** Positive = moved up, negative = moved down, 0 = same or new. */
  private rankChange(entry: LeaderboardEntry): number {
    const previous = this.baseline[entry.playerId];
    return previous === undefined ? 0 : previous - entry.rank;
  }
}