import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { swedishOrdinal } from '../../swedish-ordinal';
import { Supabase } from '../../supabase';

type WhoPhase = 'closed' | 'answering' | 'guessing' | 'finished';

interface WhoQuestion {
  id: string;
  text: string;
  my_answer: string | null;
}

interface WhoCard {
  answer_id: string;
  question: string;
  text: string;
  my_guess: string | null;
}

interface WhoResult {
  question: string;
  text: string;
  author: string;
  mine: boolean;
  my_guess: string | null;
  correct: boolean | null;
}

interface WhoScore {
  player_id: string;
  username: string;
  points: number;
  rank: number;
}

interface WhoState {
  phase: WhoPhase;
  questions?: WhoQuestion[];
  cards?: WhoCard[];
  players?: { id: string; username: string }[];
  results?: WhoResult[];
  scores?: WhoScore[];
  my_points?: number;
  my_player_id?: string;
}

const ERRORS: Record<string, string> = {
  not_answering: 'Svaren är stängda nu.',
  not_guessing: 'Gissningen är stängd nu.',
  invalid_text: 'Varje svar måste vara 1–200 tecken.',
  unknown_question: 'Frågorna har ändrats. Ladda om sidan.',
  unknown_answer: 'Svaret finns inte längre. Ladda om sidan.',
  unknown_player: 'Du kan inte gissa på den spelaren.',
};

@Component({
  imports: [RouterLink],
  selector: 'app-who-answered',
  styleUrl: './who-answered.scss',
  templateUrl: './who-answered.html',
})
export class WhoAnswered implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly state = signal<WhoState | null>(null);
  /** Det spelaren har skrivit, per fråga. Skrivs inte över när sidan laddas om. */
  protected readonly drafts = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly saved = signal(false);

  /** Vilket kort som visas under gissningen. */
  protected readonly index = signal(0);
  /** True när spelaren valt att ändra sina redan skickade svar. */
  protected readonly editing = signal(false);
  /** True när spelaren tryckt "Klar" på sista kortet. */
  protected readonly guessDone = signal(false);

  protected readonly questions = computed(() => this.state()?.questions ?? []);
  protected readonly cards = computed(() => this.state()?.cards ?? []);
  protected readonly players = computed(() => this.state()?.players ?? []);
  protected readonly card = computed(() => this.cards()[this.index()] ?? null);
  protected readonly isLastCard = computed(() => this.index() === this.cards().length - 1);
  protected readonly unguessed = computed(() => this.cards().filter((c) => !c.my_guess).length);

  protected readonly scores = computed(() => this.state()?.scores ?? []);
  protected readonly myPlayerId = computed(() => this.state()?.my_player_id ?? '');
  protected readonly myRank = computed(() => {
    const me = this.scores().find((s) => s.player_id === this.myPlayerId());
    return me ? swedishOrdinal(me.rank) : '';
  });

  private readonly results = computed(() => this.state()?.results ?? []);
  protected readonly correctCount = computed(() => this.results().filter((r) => r.correct).length);
  protected readonly guessableCount = computed(() => this.results().filter((r) => !r.mine).length);

  /** Svaren grupperade per fråga, i frågornas ordning. */
  protected readonly resultGroups = computed(() => {
    const groups: { question: string; answers: WhoResult[] }[] = [];
    for (const r of this.results()) {
      const last = groups.at(-1);
      if (last?.question === r.question) last.answers.push(r);
      else groups.push({ question: r.question, answers: [r] });
    }
    return groups;
  });

  protected readonly canSubmit = computed(
    () =>
      !this.busy() &&
      this.questions().length > 0 &&
      this.questions().every((q) => (this.drafts()[q.id] ?? '').trim().length > 0),
  );

  constructor() {
    // Kolla fasen var 5:e sekund, så att vyn byts när värden öppnar nästa steg.
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

  protected setDraft(questionId: string, text: string) {
    this.drafts.update((d) => ({ ...d, [questionId]: text }));
    this.saved.set(false);
  }

  protected async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const answers = this.questions().map((q) => ({
        question_id: q.id,
        text: (this.drafts()[q.id] ?? '').trim(),
      }));
      const { data, error } = await this.supabase.rpc('who_submit_answers', { p_answers: answers });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (result.ok) {
        this.saved.set(true);
        this.editing.set(false);
      } else {
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        if (result.error === 'not_answering') await this.load();
      }
    } catch {
      this.error.set('Något gick fel. Försök igen.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Sparar gissningen direkt och visar den markerad. Går tillbaka om det inte gick att spara. */
  protected async guess(playerId: string) {
    const card = this.card();
    if (!card) return;
    const previous = card.my_guess;
    this.setGuess(card.answer_id, playerId);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('who_submit_guess', {
        p_answer_id: card.answer_id,
        p_guessed_player_id: playerId,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        this.setGuess(card.answer_id, previous);
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        if (result.error === 'not_guessing') await this.load();
      }
    } catch {
      this.setGuess(card.answer_id, previous);
      this.error.set('Kunde inte spara gissningen. Försök igen.');
    }
  }

  protected previous() {
    this.index.update((i) => Math.max(0, i - 1));
    this.error.set('');
  }

  protected next() {
    this.error.set('');
    if (this.isLastCard()) {
      this.guessDone.set(true);
      return;
    }
    this.index.update((i) => i + 1);
  }

  protected editAnswers() {
    this.editing.set(true);
  }

  protected backToGuessing() {
    this.guessDone.set(false);
  }

  private setGuess(answerId: string, playerId: string | null) {
    this.state.update((s) =>
      s && {
        ...s,
        cards: s.cards?.map((c) => (c.answer_id === answerId ? { ...c, my_guess: playerId } : c)),
      },
    );
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('who_player_state');
    if (error) {
      this.error.set('Kunde inte hämta aktiviteten.');
      return;
    }
    const state = data as WhoState;
    // Fyll i tidigare svar, men skriv aldrig över något spelaren redan skrivit.
    this.drafts.update((d) => {
      const next = { ...d };
      for (const q of state.questions ?? []) {
        if (next[q.id] === undefined && q.my_answer) next[q.id] = q.my_answer;
      }
      return next;
    });
    if (state.phase === 'answering' && state.questions?.every((q) => q.my_answer)) {
      this.saved.set(true);
    }
    this.state.set(state);
  }
}