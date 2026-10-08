import { Component, inject, OnInit, signal } from '@angular/core';
import { Supabase } from '../../../supabase';

type Choice = 'a' | 'b' | 'c';

interface QuizQuestion {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct: Choice;
}

/** Formulärets innehåll: en ny fråga (id null) eller en som redigeras. */
interface Draft {
  id: string | null;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct: Choice | null;
}

const emptyDraft = (): Draft => ({ id: null, text: '', option_a: '', option_b: '', option_c: '', correct: null });

const ERRORS: Record<string, string> = {
  invalid_text: 'Frågan måste vara 1–200 tecken.',
  invalid_option: 'Alla tre alternativ måste fyllas i (högst 100 tecken).',
  invalid_correct: 'Välj vilket alternativ som är rätt.',
  not_editable: 'Quizet har öppnats och kan inte ändras längre.',
  unknown_question: 'Frågan finns inte längre.',
};

/** Redaktörens quizfrågor: tre alternativ och ett rätt svar per fråga. */
@Component({
  imports: [],
  selector: 'app-editor-quiz',
  styleUrl: './editor-quiz.scss',
  templateUrl: './editor-quiz.html',
})
export class EditorQuiz implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly questions = signal<QuizQuestion[]>([]);
  protected readonly editable = signal(true);
  protected readonly draft = signal<Draft>(emptyDraft());
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly choices: Choice[] = ['a', 'b', 'c'];

  ngOnInit() {
    this.load();
  }

  protected setField(field: 'text' | 'option_a' | 'option_b' | 'option_c', value: string) {
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected setCorrect(choice: Choice) {
    this.draft.update((d) => ({ ...d, correct: choice }));
  }

  protected edit(q: QuizQuestion) {
    this.draft.set({ ...q });
    this.error.set('');
  }

  protected cancel() {
    this.draft.set(emptyDraft());
    this.error.set('');
  }

  protected option(q: QuizQuestion, choice: Choice): string {
    return q[`option_${choice}`];
  }

  protected async save() {
    const d = this.draft();
    if (!d.correct) {
      this.error.set(ERRORS['invalid_correct']);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('editor_save_quiz_question', {
        p_question_id: d.id,
        p_text: d.text,
        p_option_a: d.option_a,
        p_option_b: d.option_b,
        p_option_c: d.option_c,
        p_correct: d.correct,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        return;
      }
      this.draft.set(emptyDraft());
    } catch {
      this.error.set('Något gick fel. Försök igen.');
    } finally {
      await this.load();
      this.busy.set(false);
    }
  }

  protected async remove(q: QuizQuestion) {
    if (!confirm(`Ta bort frågan "${q.text}"?`)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('editor_delete_quiz_question', { p_question_id: q.id });
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
    const { data, error } = await this.supabase.rpc('editor_quiz');
    if (error) {
      this.error.set('Kunde inte hämta quizet.');
      return;
    }
    const result = data as { editable: boolean; questions: QuizQuestion[] };
    this.editable.set(result.editable);
    this.questions.set(result.questions);
  }
}