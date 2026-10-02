import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminSession } from '../../admin-session';
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

  protected readonly email = signal('');
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

  protected async signOut() {
    await this.admin.signOut();
    this.router.navigateByUrl('/start');
  }
}
