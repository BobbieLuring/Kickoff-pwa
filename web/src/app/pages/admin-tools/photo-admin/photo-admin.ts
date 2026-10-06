import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Supabase } from '../../../supabase';

type PhotoPhase = 'closed' | 'uploading' | 'guessing' | 'finished';

interface PhotoOverview {
  phase: PhotoPhase;
  player_count: number;
  uploaded_count: number;
}

const PHASE_LABELS: Record<PhotoPhase, string> = {
  closed: 'Inte öppnad',
  uploading: 'Uppladdning pågår',
  guessing: 'Gissning pågår',
  finished: 'Avslutad',
};

const NEXT_ACTION: Record<PhotoPhase, string | null> = {
  closed: 'Öppna för uppladdning',
  uploading: 'Öppna gissningen',
  guessing: 'Avsluta och dela ut poäng',
  finished: null,
};

/** Admin-delen för Vems bild?: räknare och knappen för nästa fas. Visar aldrig bilderna. */
@Component({
  imports: [],
  selector: 'app-photo-admin',
  styleUrl: './photo-admin.scss',
  templateUrl: './photo-admin.html',
})
export class PhotoAdmin implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly overview = signal<PhotoOverview | null>(null);
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

  constructor() {
    // Räknaren uppdateras var 5:e sekund medan uppladdning eller gissning pågår.
    const timer = setInterval(() => {
      const phase = this.overview()?.phase;
      if (phase === 'uploading' || phase === 'guessing') this.load();
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
      closed: 'Öppna Vems bild? för uppladdning?',
      uploading: `Öppna gissningen? ${o.uploaded_count} av ${o.player_count} har laddat upp. Ingen kan ladda upp efter det.`,
      guessing: 'Avsluta och dela ut poäng? Det går inte att ångra.',
      finished: '',
    }[o.phase];
    if (!question || !confirm(question)) return;

    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('advance_section', { p_key: 'photo' });
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
    const { data, error } = await this.supabase.rpc('photo_admin_overview');
    if (error) {
      this.error.set('Kunde inte hämta Vems bild?.');
      return;
    }
    this.overview.set(data as PhotoOverview);
  }
}