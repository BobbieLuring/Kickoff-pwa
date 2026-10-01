import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../supabase';

interface CodeCheck {
  ok: boolean;
  room_name?: string;
  attempts_left?: number;
  locked_until?: string | null;
}

@Component({
  imports: [FormsModule],
  selector: 'app-start',
  styleUrl: './start.scss',
  templateUrl: './start.html',
})
export class Start {
  private readonly supabase = inject(Supabase).client;

  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  // Tillfälligt tills skärmen "Vem är du?" finns.
  protected readonly roomName = signal('');

  protected async submit() {
    this.busy.set(true);
    this.error.set('');
    this.roomName.set('');
    try {
      // Anonym session per enhet, så att servern kan räkna felaktiga försök.
      const { data: session } = await this.supabase.auth.getSession();
      if (!session.session) {
        const { error } = await this.supabase.auth.signInAnonymously();
        if (error) throw error;
      }

      const { data, error } = await this.supabase.rpc('check_room_code', { p_code: this.code() });
      if (error) throw error;
      const result = data as CodeCheck;

      if (result.ok) {
        this.roomName.set(result.room_name ?? '');
      } else if (result.locked_until) {
        const minutes = Math.ceil((Date.parse(result.locked_until) - Date.now()) / 60000);
        this.error.set(`För många försök. Försök igen om ${minutes} min.`);
      } else {
        this.error.set(`Fel kod. ${result.attempts_left} försök kvar.`);
      }
    } catch (e) {
      this.error.set(`Något gick fel: ${(e as Error).message}`);
    } finally {
      this.busy.set(false);
    }
  }
}
