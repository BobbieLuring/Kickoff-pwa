import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { WhoAnswered } from './pages/who-answered/who-answered';
import { Game } from './pages/game/game';
import { Missions } from './pages/missions/missions';
import { Leaderboard } from './pages/leaderboard/leaderboard';
import { Start } from './pages/start/start';

// Inloggning finns inte än: ingen är i ett rum, så spelsidorna skickar till startskärmen.
const inRoom = () => inject(Router).parseUrl('/start');

export const routes: Routes = [
  { path: '', component: Home, canActivate: [inRoom] },
  { path: 'svara', component: WhoAnswered, canActivate: [inRoom] },
  { path: 'spel', component: Game, canActivate: [inRoom] },
  { path: 'uppdrag', component: Missions, canActivate: [inRoom] },
  { path: 'topplista', component: Leaderboard, canActivate: [inRoom] },
  // Utanför rummet: ingen bottenmeny och inget spelarnamn.
  { path: 'start', component: Start, data: { outsideRoom: true } },
  { path: '**', redirectTo: '' },
];
