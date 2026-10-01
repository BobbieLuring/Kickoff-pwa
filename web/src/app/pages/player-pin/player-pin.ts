import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PinInput } from '../../layout/pin-input/pin-input';
import { PlayerSession } from '../../player-session';
import { Supabase } from '../../supabase';

interface RoomPlayers {
  ok: boolean;
  players?: { id: string; username: string }[];
}

interface LoginResult {
  ok: boolean;
  error?: 'unknown_player';
  attempts_left?: number;
  locked_until?: string | null;
}

@Component({
  imports: [FormsModule, RouterLink, PinInput],
  selector: 'app-player-pin',
  styleUrl: './player-pin.scss',
  templateUrl: './player-pin.html',
})
export class PlayerPin implements OnInit {
  private readonly supabase = inject(Supabase).client;
  private readonly router = inject(Router);
  private readonly session = inject(PlayerSession);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;
  /** Rumskoden och spelaren från URL:en (`rum/:kod/spelare/:id`). */
  private readonly kod = this.params.get('kod') ?? '';
  private readonly playerId = this.params.get('id') ?? '';

  private readonly pinInput = viewChild.required(PinInput);

  protected readonly name = signal('');
  protected readonly pin = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly locked = signal(false);

  async ngOnInit() {
    const { data } = await this.supabase.rpc('list_room_players', { p_code: this.kod });
    const player = (data as RoomPlayers | null)?.players?.find((p) => p.id === this.playerId);
    if (!player) {
      this.router.navigateByUrl('/start');
      return;
    }
    this.name.set(player.username);
  }

  protected async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('player_login', {
        p_code: this.kod,
        p_player_id: this.playerId,
        p_pin: this.pin(),
      });
      if (error) throw error;
      const result = data as LoginResult;

      if (result.ok) {
        this.session.reset();
        this.router.navigateByUrl('/');
        return;
      }
      if (result.locked_until) {
        const minutes = Math.ceil((Date.parse(result.locked_until) - Date.now()) / 60000);
        this.locked.set(true);
        this.error.set(`För många försök. Försök igen om ${minutes} min.`);
      } else if (result.attempts_left !== undefined) {
        this.error.set(`Fel PIN-kod. ${result.attempts_left} försök kvar.`);
      } else {
        // Koden gäller inte längre eller spelaren finns inte.
        this.router.navigateByUrl('/start');
        return;
      }
      this.pinInput().clear();
    } catch (e) {
      this.error.set(`Något gick fel: ${(e as Error).message}`);
    } finally {
      this.busy.set(false);
    }
  }
}
