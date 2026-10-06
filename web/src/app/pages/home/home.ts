import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeaderboardData } from '../../leaderboard-data';
import { PlayerSession } from '../../player-session';
import { RoomSections, STATUS_LABELS } from '../../room-sections';
import { swedishOrdinal } from '../../swedish-ordinal';
import { HomeSummary, SectionSummary } from './home-summary';

/** Aktiviteterna på startsidan, i ordning. `key` är nyckeln i tabellen sections. */
const SECTIONS = [
  { key: 'who', title: 'Vem svarade?', path: '/aktiviteter/vem-svarade' },
  { key: 'game', title: 'Spel', path: '/spel' },
  { key: 'missions', title: 'Uppdrag', path: '/uppdrag' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly leaderboard = inject(LeaderboardData);
  private readonly sections = inject(RoomSections);
  private readonly player = inject(PlayerSession);

  protected readonly statusLabels = STATUS_LABELS;

  protected readonly summary = computed<HomeSummary | null>(() => {
    if (!this.leaderboard.loaded()) return null;
    const entries = this.leaderboard.entries();
    const me = entries.find((e) => e.playerId === this.leaderboard.myPlayerId());
    if (!me) return null;
    const leaderPoints = entries[0]?.points ?? 0;
    const sections: SectionSummary[] = SECTIONS.map((s) => ({
      title: s.title,
      path: s.path,
      status: this.sections.status(s.key),
    }));
    return {
      playerName: this.player.current()?.username ?? me.name,
      points: me.points,
      rank: me.rank,
      pointsBehindLeader: leaderPoints - me.points,
      sections,
    };
  });

  protected readonly rankLabel = computed(() => {
    const s = this.summary();
    return s ? swedishOrdinal(s.rank) : '';
  });

  constructor() {
    this.leaderboard.start();
    this.sections.start();
  }
}