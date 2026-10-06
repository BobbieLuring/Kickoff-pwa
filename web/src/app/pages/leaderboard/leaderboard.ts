import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { LeaderboardData } from '../../leaderboard-data';
import { LeaderboardEntry } from './leaderboard-entry';
import { loadLastSeenRanks, saveLastSeenRanks } from './last-seen-ranks';

@Component({
  imports: [],
  selector: 'app-leaderboard',
  styleUrl: './leaderboard.scss',
  templateUrl: './leaderboard.html',
})
export class Leaderboard {
  private readonly data = inject(LeaderboardData);

  protected readonly entries = this.data.entries;
  protected readonly myPlayerId = this.data.myPlayerId;
  protected readonly loaded = this.data.loaded;

  // Ranks from the previous visit. Read once when the list first arrives, so arrows stay put
  // during this visit even if new points come in.
  private readonly baseline = signal<Record<string, number> | null>(null);

  protected readonly rows = computed(() =>
    this.entries().map((entry) => ({ ...entry, change: this.rankChange(entry) })),
  );

  /** The top three on the podium, in display order 2–1–3. Only shown with at least three players. */
  protected readonly podium = computed(() => {
    const rows = this.rows();
    if (rows.length < 3) return [];
    return [
      { ...rows[1], place: 2 },
      { ...rows[0], place: 1 },
      { ...rows[2], place: 3 },
    ];
  });

  /** Everyone below the podium (or everyone, when there's no podium). */
  protected readonly rest = computed(() => this.rows().slice(this.podium().length));

  constructor() {
    this.data.start();

    effect(() => {
      if (!this.loaded()) return;
      const me = this.myPlayerId();
      const entries = this.entries();
      untracked(() => {
        if (this.baseline() === null) this.baseline.set(loadLastSeenRanks(me));
      });
      // Whatever is shown now becomes the baseline for the next visit.
      saveLastSeenRanks(me, entries);
    });
  }

  /** Positive = moved up, negative = moved down, 0 = same or new. */
  private rankChange(entry: LeaderboardEntry): number {
    const previous = this.baseline()?.[entry.playerId];
    return previous === undefined ? 0 : previous - entry.rank;
  }
}