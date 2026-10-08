import { Component, inject, OnInit, signal } from '@angular/core';
import { SortList } from '../../layout/sort-list/sort-list';
import { Supabase } from '../../supabase';
import { EditorMissions } from './editor-missions/editor-missions';

type RoundPhase = 'closed' | 'open' | 'finished';

interface EditorRound {
  id: string;
  title: string;
  phase: RoundPhase;
  items: DraftRow[];
}

interface DraftRow {
  label: string;
  value: string;
}

const PHASE_LABELS: Record<RoundPhase, string> = {
  closed: 'Inte öppnad',
  open: 'Öppen · låst',
  finished: 'Avslutad · låst',
};

const ERRORS: Record<string, string> = {
  need_six: 'Rundan måste ha exakt sex rader.',
  invalid_title: 'Titeln måste vara 1–120 tecken.',
  invalid_item: 'Namn och värde måste vara 1–40 tecken.',
  not_editable: 'Rundan har redan öppnats och kan inte ändras.',
};

const emptyRows = (): DraftRow[] => Array.from({ length: 6 }, () => ({ label: '', value: '' }));

/** Redaktörens sida: en utomstående lägger in Sortera-rundorna för ett rum. */
@Component({
  imports: [SortList, EditorMissions],
  selector: 'app-editor',
  styleUrl: './editor.scss',
  templateUrl: './editor.html',
})
export class Editor implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly phaseLabels = PHASE_LABELS;
  protected readonly roomName = signal('');
  protected readonly rounds = signal<EditorRound[]>([]);

  /** undefined = inget formulär, null = ny runda, annars id:t på rundan som redigeras. */
  protected readonly editingId = signal<string | null | undefined>(undefined);
  protected readonly title = signal('');
  protected readonly rows = signal<DraftRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  async ngOnInit() {
    const { data } = await this.supabase.rpc('editor_room');
    this.roomName.set((data as { room_name: string } | null)?.room_name ?? '');
    await this.loadRounds();
  }

  protected newRound() {
    this.editingId.set(null);
    this.title.set('');
    this.rows.set(emptyRows());
    this.error.set('');
  }

  protected edit(round: EditorRound) {
    this.editingId.set(round.id);
    this.title.set(round.title);
    this.rows.set(round.items.map((i) => ({ ...i })));
    this.error.set('');
  }

  protected cancel() {
    this.editingId.set(undefined);
    this.error.set('');
  }

  protected async save() {
    const rows = this.rows().map((r) => ({ label: r.label.trim(), value: r.value.trim() }));
    if (!this.title().trim() || rows.some((r) => !r.label || !r.value)) {
      this.error.set('Fyll i titeln och namn och värde på alla sex rader.');
      return;
    }

    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('editor_save_round', {
        p_round_id: this.editingId() ?? null,
        p_title: this.title(),
        p_items: rows,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        return;
      }
      this.editingId.set(undefined);
      await this.loadRounds();
    } catch {
      this.error.set('Något gick fel. Försök igen.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(round: EditorRound) {
    if (!confirm(`Ta bort "${round.title}"?`)) return;
    const { data } = await this.supabase.rpc('editor_delete_round', { p_round_id: round.id });
    const result = data as { ok: boolean; error?: string } | null;
    if (result && !result.ok) this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
    await this.loadRounds();
  }

  private async loadRounds() {
    const { data, error } = await this.supabase.rpc('editor_rounds');
    if (error) {
      this.error.set('Kunde inte hämta rundorna.');
      return;
    }
    this.rounds.set(data as EditorRound[]);
  }
}