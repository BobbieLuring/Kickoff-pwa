import { Component, inject, OnInit, signal } from '@angular/core';
import { Supabase } from '../../../supabase';

interface Mission {
  id: string;
  text: string;
}

const ERRORS: Record<string, string> = {
  invalid_text: 'Uppdraget måste vara 1–300 tecken.',
  not_editable: 'Uppdragen har öppnats och kan inte ändras längre.',
  unknown_mission: 'Uppdraget finns inte längre.',
};

/** Redaktörens uppdrag: lägg till, ändra och ta bort, tills värden öppnar uppdragen. */
@Component({
  imports: [],
  selector: 'app-editor-missions',
  styleUrl: './editor-missions.scss',
  templateUrl: './editor-missions.html',
})
export class EditorMissions implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly missions = signal<Mission[]>([]);
  protected readonly editable = signal(true);
  protected readonly newText = signal('');

  /** Uppdraget som redigeras just nu, och dess text. */
  protected readonly editingId = signal<string | null>(null);
  protected readonly editText = signal('');

  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngOnInit() {
    this.load();
  }

  protected async add() {
    const text = this.newText().trim();
    if (!text) return;
    if (await this.save(null, text)) this.newText.set('');
  }

  protected startEdit(mission: Mission) {
    this.editingId.set(mission.id);
    this.editText.set(mission.text);
    this.error.set('');
  }

  protected cancelEdit() {
    this.editingId.set(null);
    this.error.set('');
  }

  protected async saveEdit() {
    const id = this.editingId();
    const text = this.editText().trim();
    if (!id || !text) return;
    if (await this.save(id, text)) this.editingId.set(null);
  }

  protected async remove(mission: Mission) {
    if (!confirm(`Ta bort uppdraget "${mission.text}"?`)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('editor_delete_mission', { p_mission_id: mission.id });
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

  /** Sparar ett nytt (id null) eller ändrat uppdrag. Returnerar true om det gick. */
  private async save(id: string | null, text: string): Promise<boolean> {
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('editor_save_mission', {
        p_mission_id: id,
        p_text: text,
      });
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

  private async load() {
    const { data, error } = await this.supabase.rpc('editor_missions');
    if (error) {
      this.error.set('Kunde inte hämta uppdragen.');
      return;
    }
    const result = data as { editable: boolean; missions: Mission[] };
    this.editable.set(result.editable);
    this.missions.set(result.missions);
  }
}