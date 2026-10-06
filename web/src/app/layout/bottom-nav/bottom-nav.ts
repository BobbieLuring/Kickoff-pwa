import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PlayerSession } from '../../player-session';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  private readonly player = inject(PlayerSession);

  private readonly baseItems = [
    { label: 'Hem', path: '/' },
    { label: 'Aktiviteter', path: '/aktiviteter' },
    { label: 'Spel', path: '/spel' },
    { label: 'Uppdrag', path: '/uppdrag' },
    { label: 'Topplista', path: '/topplista' },
  ];

  // Admin-fliken visas bara för admin; sidan skyddas även av routen och databasen.
  protected readonly items = computed(() =>
    this.player.current()?.is_admin
      ? [...this.baseItems, { label: 'Admin', path: '/verktyg' }]
      : this.baseItems,
  );
}
