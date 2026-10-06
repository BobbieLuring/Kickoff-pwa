import { inject, Injectable } from '@angular/core';
import { Supabase } from '../supabase';

const CACHE_NAME = 'kickoff-photos';

/**
 * Hämtar bilder från Storage och sparar dem i telefonens cache. Bilderna ändras aldrig
 * (en uppladdning, inga byten), så varje bild laddas ner högst en gång per telefon.
 */
@Injectable({ providedIn: 'root' })
export class PhotoCache {
  private readonly supabase = inject(Supabase).client;
  private readonly urls = new Map<string, Promise<string>>();

  /** En adress som kan användas i <img src>, för bilden med den här sökvägen. */
  url(path: string): Promise<string> {
    let url = this.urls.get(path);
    if (!url) {
      url = this.load(path);
      this.urls.set(path, url);
      // Misslyckas hämtningen får nästa försök börja om.
      url.catch(() => this.urls.delete(path));
    }
    return url;
  }

  /** Lägger en bild vi redan har (t.ex. den vi just laddade upp) i cachen, utan att hämta den. */
  async store(path: string, blob: Blob) {
    await this.put(path, blob);
    this.urls.set(path, Promise.resolve(URL.createObjectURL(blob)));
  }

  private async load(path: string): Promise<string> {
    const cached = await this.match(path);
    if (cached) return URL.createObjectURL(cached);

    const { data, error } = await this.supabase.storage.from('photos').download(path);
    if (error || !data) throw error ?? new Error('download failed');
    await this.put(path, data);
    return URL.createObjectURL(data);
  }

  private async match(path: string): Promise<Blob | null> {
    try {
      const response = await (await caches.open(CACHE_NAME)).match(this.key(path));
      return response ? await response.blob() : null;
    } catch {
      return null; // Cachen kan saknas (t.ex. privat läge); då hämtas bilden varje gång.
    }
  }

  private async put(path: string, blob: Blob) {
    try {
      await (await caches.open(CACHE_NAME)).put(this.key(path), new Response(blob));
    } catch {
      // Ingen cache: bilden visas ändå, den hämtas bara igen nästa gång.
    }
  }

  private key(path: string): string {
    return `/kickoff-photos/${path}`;
  }
}