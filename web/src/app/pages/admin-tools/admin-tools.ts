import { Component, computed, inject } from '@angular/core';
import { PlayerSession } from '../../player-session';
import { WhoAdmin } from './who-admin/who-admin';

/** Admin-fliken i rummet. Adminfunktionerna läggs till här steg för steg. */
@Component({
  imports: [WhoAdmin],
  selector: 'app-admin-tools',
  styleUrl: './admin-tools.scss',
  templateUrl: './admin-tools.html',
})
export class AdminTools {
  private readonly player = inject(PlayerSession);

  // Rumskoden, bara för admin (servern skickar den inte till andra spelare).
  protected readonly roomCode = computed(() => this.player.current()?.room_code ?? null);
}
