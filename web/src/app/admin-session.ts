import { inject, Injectable, signal } from '@angular/core';
import { PlayerSession } from './player-session';
import { Supabase } from './supabase';

/** Inloggning för admin med e-post och lösenord (riktigt Supabase-konto). */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly supabase = inject(Supabase).client;
  private readonly player = inject(PlayerSession);

  /** Inloggad admins namn (från `admins.name`), eller null. Sätts av `isAdmin()`. */
  readonly name = signal<string | null>(null);

  /** Loggar in och kontrollerar att kontot är admin. Returnerar ett felmeddelande, eller null. */
  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) return 'Fel e-post eller lösenord.';
    // Sessionen har bytts, så en eventuell spelare på enheten gäller inte längre.
    this.player.reset();

    // Bara för att visa ett tydligt fel. Behörigheten kontrolleras i varje adminfunktion i databasen.
    let admin: boolean;
    try {
      admin = await this.isAdmin();
    } catch (e) {
      await this.signOut();
      return `Kunde inte kontrollera behörigheten: ${(e as Error).message}`;
    }
    if (!admin) {
      await this.signOut();
      return 'Kontot har inte admin-behörighet.';
    }
    return null;
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.player.reset();
    this.name.set(null);
  }

  /** E-post för inloggad användare, eller null. */
  async email(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.user.email ?? null;
  }

  /** Om inloggad användare är admin; sätter även `name`. Kastar om servern inte kunde svara. */
  async isAdmin(): Promise<boolean> {
    const { data: session } = await this.supabase.auth.getSession();
    let name: string | null = null;
    if (session.session && !session.session.user.is_anonymous) {
      const { data, error } = await this.supabase.rpc('admin_name');
      if (error) throw error;
      name = (data as string | null) ?? null;
    }
    this.name.set(name);
    return name !== null;
  }
}
