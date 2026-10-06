import { inject, Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from './supabase';
import { LeaderboardEntry } from './pages/leaderboard/leaderboard-entry';

interface LeaderboardResult {
  my_player_id: string;
  entries: { player_id: string; name: string; points: number; rank: number }[];
}

/** Topplistan för spelarens rum. Delas av Hem och Topplista, och hålls uppdaterad av sig själv. */
@Injectable({ providedIn: 'root' })
export class LeaderboardData {
  private readonly supabase = inject(Supabase).client;
  private channel: RealtimeChannel | null = null;

  readonly entries = signal<LeaderboardEntry[]>([]);
  readonly myPlayerId = signal('');
  /** True när listan har hämtats minst en gång. */
  readonly loaded = signal(false);

  /** Startar en gång: hämtar listan, lyssnar efter nya poäng och hämtar igen när appen visas. */
  start() {
    if (this.channel) return;
    this.refresh();

    // Ringklockan: meddelandet säger bara "något har ändrats", innehållet används inte.
    this.channel = this.supabase
      .channel('point-awards')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_awards' }, () =>
        this.refresh(),
      )
      .subscribe();

    // Telefoner tappar anslutningen när skärmen är släckt, så hämta igen när appen visas.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.refresh();
    });
  }

  async refresh() {
    const { data, error } = await this.supabase.rpc('leaderboard');
    if (error) return;
    const result = data as LeaderboardResult;
    this.myPlayerId.set(result.my_player_id);
    this.entries.set(
      result.entries.map((e) => ({
        playerId: e.player_id,
        name: e.name,
        points: e.points,
        rank: e.rank,
      })),
    );
    this.loaded.set(true);
  }
}