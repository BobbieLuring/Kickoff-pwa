import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../supabase';

type MissionPhase = 'closed' | 'open' | 'revealed';

interface MissionState {
  phase: MissionPhase;
  my_mission?: string | null;
  my_player_id?: string;
  reveal?: { player_id: string; username: string; mission: string | null }[];
}

const ERRORS: Record<string, string> = {
  not_open: 'Uppdragen är inte öppna just nu.',
  none_left: 'Inga uppdrag kvar. Säg till värden.',
};

/** Uppdrag-fliken: dra ett hemligt uppdrag, se det igen, och se allas uppdrag när värden avslöjar. */
@Component({
  imports: [RouterLink],
  selector: 'app-missions',
  styleUrl: './missions.scss',
  templateUrl: './missions.html',
})
export class Missions implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly state = signal<MissionState | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Kolla fasen var 5:e sekund, så att avslöjandet syns direkt när värden trycker.
    const timer = setInterval(() => {
      if (this.state()?.phase !== 'revealed') this.load();
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

  protected async claim() {
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('mission_claim');
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
    const { data, error } = await this.supabase.rpc('mission_player_state');
    if (error) {
      this.error.set('Kunde inte hämta uppdragen.');
      return;
    }
    this.state.set(data as MissionState);
  }
}