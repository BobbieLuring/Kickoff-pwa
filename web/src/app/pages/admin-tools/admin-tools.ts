import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerSession } from '../../player-session';
import { Supabase } from '../../supabase';
import { WhoAdmin } from './who-admin/who-admin';
import { OrderAdmin } from './order-admin/order-admin';
import { GamesAdmin } from './games-admin/games-admin';
import { PhotoAdmin } from './photo-admin/photo-admin';
import { MissionsAdmin } from './missions-admin/missions-admin';
import { QuizAdmin } from './quiz-admin/quiz-admin';

/** Admin-fliken i rummet. Adminfunktionerna läggs till här steg för steg. */
@Component({
  imports: [RouterLink, WhoAdmin, OrderAdmin, GamesAdmin, PhotoAdmin, MissionsAdmin, QuizAdmin],
  selector: 'app-admin-tools',
  styleUrl: './admin-tools.scss',
  templateUrl: './admin-tools.html',
})
export class AdminTools implements OnInit {
  private readonly player = inject(PlayerSession);
  private readonly supabase = inject(Supabase).client;

  // Rumskoden, bara för admin (servern skickar den inte till andra spelare).
  protected readonly roomCode = computed(() => this.player.current()?.room_code ?? null);

  /** Koden en utomstående anger för att lägga in innehåll. */
  protected readonly editorCode = signal<string | null>(null);

  async ngOnInit() {
    const { data } = await this.supabase.rpc('admin_editor_code');
    this.editorCode.set((data as { code: string } | null)?.code ?? null);
  }

  protected async newEditorCode() {
    if (!confirm('Skapa en ny redaktörskod? Den gamla slutar gälla och redaktören loggas ut.')) return;
    const { data } = await this.supabase.rpc('admin_regenerate_editor_code');
    this.editorCode.set((data as { code: string } | null)?.code ?? this.editorCode());
  }
}