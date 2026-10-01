import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HomeSummary, SectionStatus } from './home-summary';

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

// 1:a, 2:a, 3:e … 11:e, 12:e … 21:a, 22:a
function swedishOrdinal(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  const suffix = (last === 1 || last === 2) && lastTwo !== 11 && lastTwo !== 12 ? 'a' : 'e';
  return `${n}:${suffix}`;
}