import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PinInput } from '../../layout/pin-input/pin-input';
import { PlayerSession } from '../../player-session';
import { Supabase } from '../../supabase';

interface RegisterResult {
  ok: boolean;
  error?: 'invalid_pin' | 'invalid_name' | 'name_taken';
}

const ERRORS: Record<NonNullable<RegisterResult['error']>, string> = {
  invalid_pin: 'PIN-koden måste vara fyra siffror.',
  invalid_name: 'Namnet måste vara 1–12 tecken.',
  name_taken: 'Namnet är redan taget i det här rummet.',
};

@Component({
  imports: [FormsModule, RouterLink, PinInput],
  selector: 'app-new-player',
  styleUrl: './new-player.scss',
  templateUrl: './new-player.html',
})
export class NewPlayer {
  private readonly supabase = inject(Supabase).client;
  private readonly router = inject(Router);
  private readonly session = inject(PlayerSession);
  /** Rumskoden från URL:en (`rum/:kod/ny`). */
  private readonly kod = inject(ActivatedRoute).snapshot.paramMap.get('kod') ?? '';

  protected readonly name = signal('');
  protected readonly pin = signal('');
  protected readonly pinAgain = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly canSubmit = computed(
    () =>
      !this.busy() &&
      this.name().trim().length > 0 &&
      this.pin().length === 4 &&
      this.pinAgain().length === 4,
  );

  protected async submit() {
    this.error.set('');
    if (this.pin() !== this.pinAgain()) {
      this.error.set('PIN-koderna är inte likadana.');
      return;
    }

    this.busy.set(true);
    try {
      const { data, error } = await this.supabase.rpc('register_player', {
        p_code: this.kod,
        p_username: this.name(),
        p_pin: this.pin(),
      });
      if (error) throw error;
      const result = data as RegisterResult;

      if (result.ok) {
        this.session.reset();
        this.router.navigateByUrl('/');
      } else if (result.error) {
        this.error.set(ERRORS[result.error]);
      } else {
        // Koden gäller inte längre (spärr eller stängt rum).
        this.router.navigateByUrl('/start');
      }
    } catch (e) {
      this.error.set(`Något gick fel: ${(e as Error).message}`);
    } finally {
      this.busy.set(false);
    }
  }
}
