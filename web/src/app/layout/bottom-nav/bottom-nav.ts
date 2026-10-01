import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  protected readonly items = [
    { label: 'Hem', path: '/' },
    { label: 'Svara', path: '/svara' },
    { label: 'Spel', path: '/spel' },
    { label: 'Uppdrag', path: '/uppdrag' },
    { label: 'Topplista', path: '/topplista' },
  ];
}