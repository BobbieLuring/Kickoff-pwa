import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { WhoAnswered } from './pages/who-answered/who-answered';
import { Game } from './pages/game/game';
import { Missions } from './pages/missions/missions';
import { Leaderboard } from './pages/leaderboard/leaderboard';
import { Start } from './pages/start/start';
import { ChoosePlayer } from './pages/choose-player/choose-player';
import { NewPlayer } from './pages/new-player/new-player';
import { PlayerSession } from './player-session';

// Spelsidorna kräver en inloggad spelare, annars startskärmen.
const inRoom = async () => {
  const router = inject(Router);
  return (await inject(PlayerSession).load()) ? true : router.parseUrl('/start');
};

export const routes: Routes = [
  { path: '', component: Home, canActivate: [inRoom] },
  { path: 'svara', component: WhoAnswered, canActivate: [inRoom] },
  { path: 'spel', component: Game, canActivate: [inRoom] },
  { path: 'uppdrag', component: Missions, canActivate: [inRoom] },
  { path: 'topplista', component: Leaderboard, canActivate: [inRoom] },
  // Utanför rummet: ingen bottenmeny och inget spelarnamn.
  { path: 'start', component: Start, data: { outsideRoom: true } },
  { path: 'rum/:kod', component: ChoosePlayer, data: { outsideRoom: true } },
  { path: 'rum/:kod/ny', component: NewPlayer, data: { outsideRoom: true } },
  { path: '**', redirectTo: '' },
];
