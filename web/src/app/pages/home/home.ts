import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STOPS } from '../../itinerary';
import { LeaderboardData } from '../../leaderboard-data';
import { PlayerSession } from '../../player-session';
import { RoomSections } from '../../room-sections';
import { swedishOrdinal } from '../../swedish-ordinal';
import { HomeSummary } from './home-summary';
import { NEXT_STOP_PHRASES } from './next-stop-phrases';

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

  protected readonly greeting = greetingFor(new Date().getHours());

  /** Slumpas en gång när sidan öppnas, så att texten inte byts medan man tittar. */
  protected readonly nextStopPhrase =
    NEXT_STOP_PHRASES[Math.floor(Math.random() * NEXT_STOP_PHRASES.length)];

  protected readonly summary = computed<HomeSummary | null>(() => {
    if (!this.leaderboard.loaded()) return null;
    const entries = this.leaderboard.entries();
    const me = entries.find((e) => e.playerId === this.leaderboard.myPlayerId());
    if (!me) return null;
    const leaderPoints = entries[0]?.points ?? 0;
    return {
      playerName: this.player.current()?.username ?? me.name,
      points: me.points,
      rank: me.rank,
      pointsBehindLeader: leaderPoints - me.points,
    };
  });

  protected readonly rankLabel = computed(() => {
    const s = this.summary();
    return s ? swedishOrdinal(s.rank) : '';
  });

  /** Första stoppet på resplanen som är öppet just nu, eller null. */
  protected readonly nextStop = computed(
    () => STOPS.find((s) => this.sections.combinedStatus(s.keys) === 'open') ?? null,
  );

  constructor() {
    this.leaderboard.start();
    this.sections.start();
  }
}

function greetingFor(hour: number): string {
  if (hour < 5) return 'Uppe sent';
  if (hour < 10) return 'God morgon';
  if (hour < 18) return 'Hej';
  return 'God kväll';
}
