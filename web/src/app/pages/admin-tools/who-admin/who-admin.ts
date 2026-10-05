import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../../supabase';

type WhoPhase = 'closed' | 'answering' | 'guessing' | 'finished';

interface WhoOverview {
  phase: WhoPhase;
  questions: { id: string; text: string }[];
  player_count: number;
  answered_count: number;
}

const PHASE_LABELS: Record<WhoPhase, string> = {
  closed: 'Inte öppnad',
  answering: 'Svar pågår',
  guessing: 'Gissning pågår',
  finished: 'Avslutad',
};

const NEXT_ACTION: Record<WhoPhase, string | null> = {
  closed: 'Öppna för svar',
  answering: 'Öppna gissningen',
  guessing: 'Avsluta och dela ut poäng',
  finished: null,
};

const ERRORS: Record<string, string> = {
  already_open: 'Frågorna kan inte ändras efter att aktiviteten har öppnats.',
  invalid_text: 'Frågan måste vara 1–200 tecken.',
  already_finished: 'Aktiviteten är redan avslutad.',
};

/** Admin-delen för Vem svarade?: frågor, räknare och knappen för nästa fas. Visar aldrig svar. */
@Component({
  imports: [FormsModule],
  selector: 'app-who-admin',
  styleUrl: './who-admin.scss',
  templateUrl: './who-admin.html',
})
export class WhoAdmin implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly overview = signal<WhoOverview | null>(null);
  protected readonly newQuestion = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly phaseLabel = computed(() => {
    const o = this.overview();
    return o ? PHASE_LABELS[o.phase] : '';
  });

  protected readonly nextAction = computed(() => {
    const o = this.overview();
    return o ? NEXT_ACTION[o.phase] : null;
  });

  constructor() {
    // Räknaren uppdateras var 5:e sekund medan svar eller gissning pågår.
    const timer = setInterval(() => {
      const phase = this.overview()?.phase;
      if (phase === 'answering' || phase === 'guessing') this.load();
    }, 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    this.load();
  }

  protected async add() {
    const text = this.newQuestion().trim();
    if (!text) return;
    if (await this.call('who_add_question', { p_text: text })) this.newQuestion.set('');
  }

  protected remove(id: string) {
    this.call('who_delete_question', { p_question_id: id });
  }

  protected advance() {
    const o = this.overview();
    if (!o) return;
    const question = {
      closed: 'Öppna för svar? Frågorna kan inte ändras efter det.',
      answering: `Öppna gissningen? ${o.answered_count} av ${o.player_count} har svarat. Ingen kan svara efter det.`,
      guessing: 'Avsluta och dela ut poäng? Det går inte att ångra.',
      finished: '',
    }[o.phase];
    if (question && confirm(question)) this.call('advance_section', { p_key: 'who' });
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('who_admin_overview');
    if (error) {
      this.error.set('Kunde inte hämta frågorna.');
      return;
    }
    this.overview.set(data as WhoOverview);
  }

  /** Kör en adminfunktion, visar fel på svenska och laddar om översikten. Returnerar true om det gick. */
  private async call(fn: string, args: Record<string, unknown>): Promise<boolean> {
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc(fn, args);
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        return false;
      }
      return true;
    } catch {
      this.error.set('Något gick fel. Försök igen.');
      return false;
    } finally {
      await this.load();
      this.busy.set(false);
    }
  }
}