import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Supabase } from '../../../supabase';

type MissionPhase = 'closed' | 'open' | 'revealed';

interface MissionsOverview {
  phase: MissionPhase;
  mission_count: number;
  claimed_count: number;
  player_count: number;
}

const PHASE_LABELS: Record<MissionPhase, string> = {
  closed: 'Inte öppnad',
  open: 'Öppen',
  revealed: 'Avslöjad',
};

const NEXT_ACTION: Record<MissionPhase, string | null> = {
  closed: 'Öppna uppdragen',
  open: 'Avslöja alla uppdrag',
  revealed: null,
};

/** Admin-delen för uppdragen: antal och knappen för nästa fas. Visar aldrig uppdragstexterna. */
@Component({
  imports: [],
  selector: 'app-missions-admin',
  styleUrl: './missions-admin.scss',
  templateUrl: './missions-admin.html',
})
export class MissionsAdmin implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly overview = signal<MissionsOverview | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly phaseLabel = computed(() => {
    const o = this.overview();
    return o ? PHASE_LABELS[o.phase] : '';
  });

  protected readonly nextAction = computed(() => {
    const o = this.overview();
    return o ? NEXT_ACTION[o.phase] : null;
  });

  /** Färre uppdrag än spelare: några kommer att bli utan. */
  protected readonly tooFew = computed(() => {
    const o = this.overview();
    return !!o && o.mission_count < o.player_count;
  });

  constructor() {
    // Räknaren uppdateras var 5:e sekund medan uppdragen är öppna.
    const timer = setInterval(() => {
      if (this.overview()?.phase === 'open') this.load();
    }, 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    this.load();
  }

  protected async advance() {
    const o = this.overview();
    if (!o) return;
    const question = {
      closed: `Öppna uppdragen? ${o.mission_count} uppdrag för ${o.player_count} spelare. Redaktören kan inte ändra dem efter det.`,
      open: `Avslöja alla uppdrag? ${o.claimed_count} av ${o.player_count} har dragit ett. Alla ser allas uppdrag efter det.`,
      revealed: '',
    }[o.phase];
    if (!question || !confirm(question)) return;

    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('advance_section', { p_key: 'missions' });
      if (error) throw error;
      if (!(data as { ok: boolean }).ok) this.error.set('Något gick fel.');
    } catch {
      this.error.set('Något gick fel. Försök igen.');
    } finally {
      await this.load();
      this.busy.set(false);
    }
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('admin_missions_overview');
    if (error) {
      this.error.set('Kunde inte hämta uppdragen.');
      return;
    }
    this.overview.set(data as MissionsOverview);
  }
}