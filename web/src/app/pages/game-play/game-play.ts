import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameCanvas } from '../../games/game-canvas/game-canvas';
import { GAMES } from '../../games/games';
import { Supabase } from '../../supabase';

interface Highscore {
  player_id: string;
  username: string;
  best: number;
  rank: number;
  points: number | null;
}

interface GameState {
  phase: 'closed' | 'open' | 'finished';
  my_player_id: string;
  highscores: Highscore[];
}

/** Ett spel: canvasen, ens bästa resultat och topplistan för spelet. */
@Component({
  imports: [GameCanvas, RouterLink],
  selector: 'app-game-play',
  styleUrl: './game-play.scss',
  templateUrl: './game-play.html',
})
export class GamePlay implements OnInit {
  private readonly supabase = inject(Supabase).client;
  private readonly key = inject(ActivatedRoute).snapshot.paramMap.get('game') ?? '';

  protected readonly info = GAMES.find((g) => g.key === this.key) ?? null;
  /** Spelets regler skapas en gång och återanvänds mellan omgångarna. */
  protected readonly rules = this.info?.create() ?? null;

  protected readonly state = signal<GameState | null>(null);
  protected readonly message = signal('');

  protected readonly myBest = computed(() => {
    const s = this.state();
    return s?.highscores.find((h) => h.player_id === s.my_player_id)?.best ?? null;
  });

  constructor() {
    // Topplistan uppdateras var 5:e sekund medan spelet är öppet, och när appen visas.
    const timer = setInterval(() => {
      if (this.state()?.phase !== 'finished') this.load();
    }, 5000);
    const onVisible = () => document.visibilityState === 'visible' && this.load();
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  ngOnInit() {
    this.load();
  }

  /** En omgång är slut: skicka in resultatet direkt. */
  protected async onFinished(score: number) {
    this.message.set('');
    const { data, error } = await this.supabase.rpc('game_submit_score', {
      p_game: this.key,
      p_score: score,
    });
    const result = data as { ok: boolean; error?: string } | null;
    if (error || !result?.ok) {
      this.message.set(
        result?.error === 'not_open' ? 'Spelet har stängt. Resultatet räknades inte.' : 'Kunde inte spara resultatet.',
      );
    }
    await this.load();
  }

  private async load() {
    if (!this.info) return;
    const { data, error } = await this.supabase.rpc('game_state', { p_game: this.key });
    if (!error) this.state.set(data as GameState);
  }
}