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
import { PlayerPin } from './pages/player-pin/player-pin';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Admin } from './pages/admin/admin';
import { PlayerSession } from './player-session';
import { AdminSession } from './admin-session';

// Spelsidorna kräver en inloggad spelare, annars startskärmen.
const inRoom = async () => {
  const router = inject(Router);
  return (await inject(PlayerSession).load()) ? true : router.parseUrl('/start');
};

// Adminsidorna kräver ett admin-konto, annars admin-inloggningen.
const isAdmin = async () => {
  const router = inject(Router);
  const admin = await inject(AdminSession)
    .isAdmin()
    .catch(() => false);
  return admin ? true : router.parseUrl('/admin/logga-in');
};

const adminPage = { outsideRoom: true, header: 'Admin' };

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
  { path: 'rum/:kod/spelare/:id', component: PlayerPin, data: { outsideRoom: true } },
  // Admin: ingen bottenmeny, "Admin" i headern.
  { path: 'admin/logga-in', component: AdminLogin, data: adminPage },
  { path: 'admin', component: Admin, canActivate: [isAdmin], data: adminPage },
  { path: '**', redirectTo: '' },
];
