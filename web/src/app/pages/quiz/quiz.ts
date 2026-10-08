import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../supabase';
import { swedishOrdinal } from '../../swedish-ordinal';

type Choice = 'a' | 'b' | 'c';

interface QuizQuestion {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  my_choice: Choice | null;
  correct?: Choice;
}

interface QuizScore {
  player_id: string;
  username: string;
  points: number;
  rank: number;
}

interface QuizState {
  phase: 'closed' | 'open' | 'finished';
  questions?: QuizQuestion[];
  scores?: QuizScore[];
  my_points?: number;
  my_player_id?: string;
}

const ERRORS: Record<string, string> = {
  not_open: 'Quizet är stängt nu.',
  unknown_question: 'Frågan finns inte längre. Ladda om sidan.',
};

/** Quiz: frågor med A/B/C. Svaret sparas direkt och kan ändras tills värden stänger. */
@Component({
  imports: [RouterLink],
  selector: 'app-quiz',
  styleUrl: './quiz.scss',
  templateUrl: './quiz.html',
})
export class Quiz implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly state = signal<QuizState | null>(null);
  protected readonly error = signal('');
  protected readonly choices: Choice[] = ['a', 'b', 'c'];

  protected readonly questions = computed(() => this.state()?.questions ?? []);
  protected readonly answeredCount = computed(() => this.questions().filter((q) => q.my_choice).length);
  protected readonly correctCount = computed(
    () => this.questions().filter((q) => q.correct && q.my_choice === q.correct).length,
  );
  protected readonly scores = computed(() => this.state()?.scores ?? []);
  protected readonly myPlayerId = computed(() => this.state()?.my_player_id ?? '');
  protected readonly myRank = computed(() => {
    const me = this.scores().find((s) => s.player_id === this.myPlayerId());
    return me ? swedishOrdinal(me.rank) : '';
  });

  constructor() {
    // Kolla fasen var 5:e sekund, så att resultatet visas när värden stänger.
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

  protected option(q: QuizQuestion, choice: Choice): string {
    return q[`option_${choice}`];
  }

  /** Sparar svaret direkt. Går tillbaka om det inte gick att spara. */
  protected async answer(q: QuizQuestion, choice: Choice) {
    const previous = q.my_choice;
    this.setChoice(q.id, choice);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('quiz_submit_answer', {
        p_question_id: q.id,
        p_choice: choice,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        this.setChoice(q.id, previous);
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        if (result.error === 'not_open') await this.load();
      }
    } catch {
      this.setChoice(q.id, previous);
      this.error.set('Kunde inte spara svaret. Försök igen.');
    }
  }

  private setChoice(questionId: string, choice: Choice | null) {
    this.state.update((s) =>
      s && {
        ...s,
        questions: s.questions?.map((q) => (q.id === questionId ? { ...q, my_choice: choice } : q)),
      },
    );
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('quiz_player_state');
    if (error) {
      this.error.set('Kunde inte hämta quizet.');
      return;
    }
    this.state.set(data as QuizState);
  }
}