import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Supabase } from '../../../supabase';

type RoundPhase = 'closed' | 'open' | 'finished';

interface AdminRound {
  id: string;
  title: string;
  phase: RoundPhase;
  ready: boolean;
  submitted_count: number;
}

interface OrderOverview {
  player_count: number;
  rounds: AdminRound[];
}

const PHASE_LABELS: Record<RoundPhase, string> = {
  closed: 'Inte öppnad',
  open: 'Öppen',
  finished: 'Avslutad',
};

const ERRORS: Record<string, string> = {
  not_ready: 'Rundan har inte sex namn än.',
  already_finished: 'Rundan är redan avslutad.',
  unknown_round: 'Rundan finns inte längre.',
};

/** Admin-delen för Sortera: öppna och stäng rundorna en i taget. Visar aldrig namn eller ordning. */
@Component({
  imports: [],
  selector: 'app-order-admin',
  styleUrl: './order-admin.scss',
  templateUrl: './order-admin.html',
})
export class OrderAdmin implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly phaseLabels = PHASE_LABELS;
  protected readonly overview = signal<OrderOverview | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Räknaren uppdateras var 5:e sekund medan någon runda är öppen.
    const timer = setInterval(() => {
      if (this.overview()?.rounds.some((r) => r.phase === 'open')) this.load();
    }, 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    this.load();
  }

  protected async advance(round: AdminRound) {
    const question =
      round.phase === 'closed'
        ? `Öppna "${round.title}"? Rundan kan inte ändras efter det.`
        : `Avsluta "${round.title}" och dela ut poäng? ${round.submitted_count} av ${this.overview()?.player_count} har skickat. Det går inte att ångra.`;
    if (!confirm(question)) return;

    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('admin_advance_round', { p_round_id: round.id });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
    } catch {
      this.error.set('Något gick fel. Försök igen.');
    } finally {
      await this.load();
      this.busy.set(false);
    }
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('admin_order_rounds');
    if (error) {
      this.error.set('Kunde inte hämta rundorna.');
      return;
    }
    this.overview.set(data as OrderOverview);
  }
}