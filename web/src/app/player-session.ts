import { inject, Injectable, signal } from '@angular/core';
import { Supabase } from './supabase';

export interface CurrentPlayer {
  id: string;
  username: string;
  room_name: string;
  /** Spelaren är admin (styr Admin-fliken; behörigheten kontrolleras i databasen). */
  is_admin: boolean;
  /** Rummets kod, bara för admin (annars `null` från servern). */
  room_code: string | null;
}

/** Spelaren som är inloggad på den här enheten. */
@Injectable({ providedIn: 'root' })
export class PlayerSession {
  private readonly supabase = inject(Supabase).client;

  /** `undefined` tills den har lästs från servern, `null` om ingen är inloggad. */
  readonly current = signal<CurrentPlayer | null | undefined>(undefined);

  /** Läser in spelaren från servern (en gång) och returnerar den. */
  async load(): Promise<CurrentPlayer | null> {
    const cached = this.current();
    if (cached !== undefined) return cached;

    const { data: session } = await this.supabase.auth.getSession();
    let player: CurrentPlayer | null = null;
    if (session.session) {
      const { data } = await this.supabase.rpc('current_player');
      player = (data as CurrentPlayer | null) ?? null;
    }
    this.current.set(player);
    return player;
  }

  /** Glöm cachen, t.ex. efter inloggning, så att nästa `load()` frågar servern. */
  reset() {
    this.current.set(undefined);
  }
}
