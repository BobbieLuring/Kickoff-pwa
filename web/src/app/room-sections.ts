import { inject, Injectable, signal } from '@angular/core';
import { Supabase } from './supabase';

export type SectionStatus = 'soon' | 'open' | 'closed';

export const STATUS_LABELS: Record<SectionStatus, string> = {
  soon: 'Snart',
  open: 'Öppen',
  closed: 'Avslutad',
};

/** Fasen i databasen → status i appen. */
export function toStatus(phase: string | undefined): SectionStatus {
  if (!phase || phase === 'closed') return 'soon';
  if (phase === 'finished') return 'closed';
  return 'open';
}

/** Faserna för aktiviteterna i spelarens rum. Delas av Hem och Aktiviteter. */
@Injectable({ providedIn: 'root' })
export class RoomSections {
  private readonly supabase = inject(Supabase).client;
  private started = false;

  /** Fasen per aktivitet, t.ex. { who: 'guessing' }. */
  readonly phases = signal<Record<string, string>>({});

  /** Startar en gång: hämtar faserna var 10:e sekund och när appen visas. */
  start() {
    if (this.started) return;
    this.started = true;
    this.refresh();
    setInterval(() => this.refresh(), 10000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.refresh();
    });
  }

  async refresh() {
    const { data, error } = await this.supabase.rpc('room_sections');
    if (!error) this.phases.set((data as Record<string, string>) ?? {});
  }

  status(key: string): SectionStatus {
    return toStatus(this.phases()[key]);
  }
}