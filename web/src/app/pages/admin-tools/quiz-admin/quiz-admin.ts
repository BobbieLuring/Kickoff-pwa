import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Supabase } from '../../../supabase';

type QuizPhase = 'closed' | 'open' | 'finished';

interface QuizOverview {
  phase: QuizPhase;
  question_count: number;
  player_count: number;
  answered_count: number;
}

const PHASE_LABELS: Record<QuizPhase, string> = {
  closed: 'Inte öppnad',
  open: 'Öppen',
  finished: 'Avslutad',
};

const NEXT_ACTION: Record<QuizPhase, string | null> = {
  closed: 'Öppna quizet',
  open: 'Avsluta och dela ut poäng',
  finished: null,
};

/** Admin-delen för quizet: antal frågor, räknare och knappen för nästa fas. Visar aldrig frågorna. */
@Component({
  imports: [],
  selector: 'app-quiz-admin',
  styleUrl: './quiz-admin.scss',
  templateUrl: './quiz-admin.html',
})
export class QuizAdmin implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly overview = signal<QuizOverview | null>(null);
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
    // Uppdateras var 5:e sekund, även innan quizet öppnats, så att man ser redaktörens frågor komma in.
    const timer = setInterval(() => {
      if (this.overview()?.phase !== 'finished') this.load();
    }, 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    this.load();
  }

  protected async advance() {
    const o = this.overview();
    if (!o) return;
    const question = {
      closed: `Öppna quizet? ${o.question_count} frågor. Redaktören kan inte ändra dem efter det.`,
      open: `Avsluta quizet och dela ut poäng? ${o.answered_count} av ${o.player_count} har svarat på alla frågor. Det går inte att ångra.`,
      finished: '',
    }[o.phase];
    if (!question || !confirm(question)) return;

    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('advance_section', { p_key: 'quiz' });
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
    const { data, error } = await this.supabase.rpc('quiz_admin_overview');
    if (error) {
      this.error.set('Kunde inte hämta quizet.');
      return;
    }
    this.overview.set(data as QuizOverview);
  }
}