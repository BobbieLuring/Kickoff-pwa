import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { GAMES } from '../../../games/games';
import { Supabase } from '../../../supabase';

type GamePhase = 'closed' | 'open' | 'finished';

interface AdminGame {
  key: string;
  phase: GamePhase;
  played_count: number;
}

interface GamesOverview {
  player_count: number;
  games: AdminGame[];
}

const PHASE_LABELS: Record<GamePhase, string> = {
  closed: 'Inte öppnat',
  open: 'Öppet',
  finished: 'Avslutat',
};

/** Admin-delen för spelen: öppna och avsluta varje spel. Avslut delar ut poäng efter placering. */
@Component({
  imports: [],
  selector: 'app-games-admin',
  styleUrl: './games-admin.scss',
  templateUrl: './games-admin.html',
})
export class GamesAdmin implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly phaseLabels = PHASE_LABELS;
  protected readonly overview = signal<GamesOverview | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Räknaren uppdateras var 5:e sekund medan något spel är öppet.
    const timer = setInterval(() => {
      if (this.overview()?.games.some((g) => g.phase === 'open')) this.load();
    }, 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    this.load();
  }

  /** Spelets namn från listan i appen, t.ex. "Pricka". */
  protected title(key: string): string {
    return GAMES.find((g) => g.key === key)?.title ?? key;
  }

  /** Bara spel som finns i appen visas. */
  protected visible(game: AdminGame): boolean {
    return GAMES.some((g) => g.key === game.key);
  }

  protected async advance(game: AdminGame) {
    const name = this.title(game.key);
    const question =
      game.phase === 'closed'
        ? `Öppna ${name}?`
        : `Avsluta ${name} och dela ut poäng efter placering? ${game.played_count} av ${this.overview()?.player_count} har spelat. Det går inte att ångra.`;
    if (!confirm(question)) return;

    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('advance_section', { p_key: game.key });
      if (error) throw error;
      if (!(data as { ok: boolean }).ok) this.error.set('Något gick fel.');
    } catch {
      this.error.set('Något gick fel. Försök igen.');
    } finally {
      await this.load();
      this.busy.set(false);
    }
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('admin_games');
    if (error) {
      this.error.set('Kunde inte hämta spelen.');
      return;
    }
    this.overview.set(data as GamesOverview);
  }
}