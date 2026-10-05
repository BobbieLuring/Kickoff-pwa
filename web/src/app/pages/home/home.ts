import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HomeSummary, SectionStatus } from './home-summary';
import { swedishOrdinal } from '../../swedish-ordinal';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  // Fake data until scores exist in Supabase.
  protected readonly summary = signal<HomeSummary>({
    playerName: 'Robert',
    points: 128,
    rank: 3,
    pointsBehindLeader: 12,
    sections: [
      { title: 'Vem svarade?', path: '/svara', status: 'open' },
      { title: 'Spel', path: '/spel', status: 'open' },
      { title: 'Uppdrag', path: '/uppdrag', status: 'soon' },
      { title: 'Topplista', path: '/topplista' },
    ],
  });

  protected readonly rankLabel = computed(() => swedishOrdinal(this.summary().rank));

  protected readonly statusLabels: Record<SectionStatus, string> = {
    soon: 'Snart',
    open: 'Öppen',
    closed: 'Avslutad',
  };
}