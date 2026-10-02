import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../supabase';

interface CreatedRoom {
  ok: boolean;
  error?: 'invalid_name';
  id?: string;
  code?: string;
}

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-admin-new-room',
  styleUrl: './admin-new-room.scss',
  templateUrl: './admin-new-room.html',
})
export class AdminNewRoom {
  private readonly supabase = inject(Supabase).client;

  protected readonly name = signal('');
  /** Rummet efter att det skapats; koden genereras av servern. */
  protected readonly room = signal<{ id: string; code: string } | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async create() {
    if (this.room()) return;
    await this.call(async () => {
      const { data, error } = await this.supabase.rpc('create_room', { p_name: this.name() });
      if (error) throw error;
      const result = data as CreatedRoom;
      if (!result.ok) {
        this.error.set('Namnet måste vara 1–60 tecken.');
        return;
      }
      this.room.set({ id: result.id!, code: result.code! });
    });
  }

  protected async newCode() {
    const room = this.room();
    if (!room) return;
    await this.call(async () => {
      const { data, error } = await this.supabase.rpc('regenerate_room_code', { p_room_id: room.id });
      if (error) throw error;
      this.room.set({ ...room, code: (data as { code: string }).code });
    });
  }

  private async call(action: () => Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(`Något gick fel: ${(e as Error).message}`);
    } finally {
      this.busy.set(false);
    }
  }
}
