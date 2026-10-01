import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Supabase } from '../../supabase';

interface Player {
  id: string;
  username: string;
}

interface RoomPlayers {
  ok: boolean;
  room_name?: string;
  players?: Player[];
}

@Component({
  imports: [],
  selector: 'app-choose-player',
  styleUrl: './choose-player.scss',
  templateUrl: './choose-player.html',
})
export class ChoosePlayer implements OnInit {
  private readonly supabase = inject(Supabase).client;
  private readonly router = inject(Router);
  /** Rumskoden från URL:en (`rum/:kod`). */
  private readonly kod = inject(ActivatedRoute).snapshot.paramMap.get('kod') ?? '';

  protected readonly loading = signal(true);
  protected readonly players = signal<Player[]>([]);

  async ngOnInit() {
    const { data, error } = await this.supabase.rpc('list_room_players', { p_code: this.kod });
    const result = data as RoomPlayers | null;
    // Ogiltig kod, spärr eller ingen session: tillbaka till startskärmen.
    if (error || !result?.ok) {
      this.router.navigateByUrl('/start');
      return;
    }
    this.players.set(result.players ?? []);
    this.loading.set(false);
  }
}
