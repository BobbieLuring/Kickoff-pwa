import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhotoCache } from '../../photos/photo-cache';
import { resizeToJpeg } from '../../photos/resize-image';
import { Supabase } from '../../supabase';
import { swedishOrdinal } from '../../swedish-ordinal';

type PhotoPhase = 'closed' | 'uploading' | 'guessing' | 'finished';

interface PhotoCard {
  photo_id: string;
  path: string;
  my_guess: string | null;
}

interface PhotoResult {
  path: string;
  owner: string;
  mine: boolean;
  my_guess: string | null;
  correct: boolean | null;
}

interface PhotoScore {
  player_id: string;
  username: string;
  points: number;
  rank: number;
}

interface PhotoState {
  phase: PhotoPhase;
  my_path?: string | null;
  cards?: PhotoCard[];
  players?: { id: string; username: string }[];
  results?: PhotoResult[];
  scores?: PhotoScore[];
  my_points?: number;
  my_player_id?: string;
}

const ERRORS: Record<string, string> = {
  not_uploading: 'Uppladdningen är stängd nu.',
  already_uploaded: 'Du har redan laddat upp en bild.',
  not_guessing: 'Gissningen är stängd nu.',
  unknown_photo: 'Bilden finns inte längre. Ladda om sidan.',
  unknown_player: 'Du kan inte gissa på den spelaren.',
};

/** Vems bild?: ladda upp en bild en gång, sedan gissar alla vems bilden är. */
@Component({
  imports: [RouterLink],
  selector: 'app-photo',
  styleUrl: './photo.scss',
  templateUrl: './photo.html',
})
export class Photo implements OnInit {
  private readonly supabase = inject(Supabase).client;
  private readonly cache = inject(PhotoCache);

  protected readonly state = signal<PhotoState | null>(null);
  /** Bildadresser för <img>, per sökväg. Fylls på från cachen. */
  protected readonly urls = signal<Record<string, string>>({});

  /** Den krympta bilden som väntar på att bekräftas. */
  private preview: Blob | null = null;
  protected readonly previewUrl = signal<string | null>(null);

  protected readonly busy = signal(false);
  protected readonly error = signal('');

  // ── Gissning ──
  protected readonly index = signal(0);
  protected readonly guessDone = signal(false);
  protected readonly cards = computed(() => this.state()?.cards ?? []);
  protected readonly players = computed(() => this.state()?.players ?? []);
  protected readonly card = computed(() => this.cards()[this.index()] ?? null);
  protected readonly isLastCard = computed(() => this.index() === this.cards().length - 1);
  protected readonly unguessed = computed(() => this.cards().filter((c) => !c.my_guess).length);

  // ── Resultat ──
  protected readonly results = computed(() => this.state()?.results ?? []);
  protected readonly scores = computed(() => this.state()?.scores ?? []);
  protected readonly myPlayerId = computed(() => this.state()?.my_player_id ?? '');
  protected readonly myRank = computed(() => {
    const me = this.scores().find((s) => s.player_id === this.myPlayerId());
    return me ? swedishOrdinal(me.rank) : '';
  });
  protected readonly correctCount = computed(() => this.results().filter((r) => r.correct).length);
  protected readonly guessableCount = computed(() => this.results().filter((r) => !r.mine).length);

  constructor() {
    // Kolla fasen var 5:e sekund, så att vyn byts när värden öppnar nästa steg.
    const timer = setInterval(() => {
      if (this.state()?.phase !== 'finished') this.load();
    }, 5000);
    const onVisible = () => document.visibilityState === 'visible' && this.load();
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      this.clearPreview();
    });
  }

  ngOnInit() {
    this.load();
  }

  // ── Uppladdning ──

  /** En bild har valts: krymp den och visa förhandsvisningen. */
  protected async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Så att samma bild kan väljas igen efter "Välj en annan".
    if (!file) return;

    this.error.set('');
    this.busy.set(true);
    try {
      this.clearPreview();
      this.preview = await resizeToJpeg(file);
      this.previewUrl.set(URL.createObjectURL(this.preview));
    } catch {
      this.error.set('Den bilden gick inte att läsa. Välj en annan.');
    } finally {
      this.busy.set(false);
    }
  }

  protected chooseAnother() {
    this.clearPreview();
    this.error.set('');
  }

  /** Reservera filnamnet och ladda upp. Går inte att ångra. */
  protected async upload() {
    if (!this.preview) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('photo_reserve');
      if (error) throw error;
      const result = data as { ok: boolean; path?: string; error?: string };
      if (!result.ok || !result.path) {
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        await this.load();
        return;
      }

      const { error: uploadError } = await this.supabase.storage
        .from('photos')
        .upload(result.path, this.preview, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      await this.cache.store(result.path, this.preview);
      this.clearPreview();
      await this.load();
    } catch {
      this.error.set('Kunde inte ladda upp bilden. Försök igen.');
    } finally {
      this.busy.set(false);
    }
  }

  // ── Gissning ──

  /** Sparar gissningen direkt. Går tillbaka om det inte gick att spara. */
  protected async guess(playerId: string) {
    const card = this.card();
    if (!card || !playerId) return;
    const previous = card.my_guess;
    this.setGuess(card.photo_id, playerId);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('photo_submit_guess', {
        p_photo_id: card.photo_id,
        p_guessed_player_id: playerId,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        this.setGuess(card.photo_id, previous);
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
        if (result.error === 'not_guessing') await this.load();
      }
    } catch {
      this.setGuess(card.photo_id, previous);
      this.error.set('Kunde inte spara gissningen. Försök igen.');
    }
  }

  protected previous() {
    this.index.update((i) => Math.max(0, i - 1));
    this.error.set('');
  }

  protected next() {
    this.error.set('');
    if (this.isLastCard()) {
      this.guessDone.set(true);
      return;
    }
    this.index.update((i) => i + 1);
  }

  protected backToGuessing() {
    this.guessDone.set(false);
  }

  private setGuess(photoId: string, playerId: string | null) {
    this.state.update((s) =>
      s && {
        ...s,
        cards: s.cards?.map((c) => (c.photo_id === photoId ? { ...c, my_guess: playerId } : c)),
      },
    );
  }

  // ── Gemensamt ──

  private clearPreview() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
    this.preview = null;
  }

  /** Hämtar bilden via cachen (högst en nedladdning per telefon) om vi inte redan har den. */
  private ensureUrl(path: string) {
    if (this.urls()[path]) return;
    this.cache
      .url(path)
      .then((url) => this.urls.update((u) => ({ ...u, [path]: url })))
      .catch(() => this.error.set('Kunde inte visa en bild. Försök igen.'));
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('photo_player_state');
    if (error) {
      this.error.set('Kunde inte hämta aktiviteten.');
      return;
    }
    const state = data as PhotoState;
    this.state.set(state);

    // Hämta alla bilder som visas i den här fasen, så att bläddringen går direkt.
    if (state.my_path) this.ensureUrl(state.my_path);
    for (const c of state.cards ?? []) this.ensureUrl(c.path);
    for (const r of state.results ?? []) this.ensureUrl(r.path);
  }
}