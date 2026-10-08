import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminSession } from '../../admin-session';
import { PlayerSession } from '../../player-session';
import { Supabase } from '../../supabase';

interface Room {
  id: string;
  name: string;
  code: string;
  closed_at: string | null;
}

@Component({
  imports: [RouterLink],
  selector: 'app-admin',
  styleUrl: './admin.scss',
  templateUrl: './admin.html',
})
export class Admin implements OnInit {
  private readonly supabase = inject(Supabase).client;
  private readonly admin = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly player = inject(PlayerSession);

  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly rooms = signal<Room[] | null>(null);
  protected readonly error = signal('');

  async ngOnInit() {
    this.email.set((await this.admin.email()) ?? '');
    const { data, error } = await this.supabase.rpc('admin_list_rooms');
    if (error) {
      this.error.set(`Kunde inte hämta rummen: ${error.message}`);
      return;
    }
    this.rooms.set(data as Room[]);
  }

  /** Går in i rummet som spelare med admins namn (utan PIN) och öppnar Home. */
  protected async join(room: Room) {
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('admin_join_room', { p_room_id: room.id });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string; name?: string };
      if (!result.ok) {
        this.error.set(
          result.error === 'name_taken'
            ? `Det finns redan en spelare som heter ${result.name} i ${room.name}.`
            : 'Rummet finns inte längre eller är avslutat.',
        );
        return;
      }
      // Ladda om appen i det nya rummet, så att allt som hör till rummet (onlineprickar, meddelanden,
      // topplistan) startar om där i stället för att ligga kvar i det förra rummet.
      this.player.reset();
      window.location.assign(document.baseURI);
    } catch (e) {
      this.error.set(`Något gick fel: ${(e as Error).message}`);
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOut() {
    await this.admin.signOut();
    this.router.navigateByUrl('/start');
  }
}
