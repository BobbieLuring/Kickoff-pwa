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
import { AdminNewRoom } from './pages/admin-new-room/admin-new-room';
import { AdminTools } from './pages/admin-tools/admin-tools';
import { PlayerSession } from './player-session';
import { AdminSession } from './admin-session';
import { Activities } from './pages/activities/activities';
import { Editor } from './pages/editor/editor';
import { Supabase } from './supabase';
import { Order } from './pages/order/order';
import { GamePlay } from './pages/game-play/game-play';

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

// Admin-fliken i rummet kräver att spelaren är admin; andra skickas till Home (eller start).
const adminInRoom = async () => {
  const router = inject(Router);
  const player = await inject(PlayerSession).load();
  if (!player) return router.parseUrl('/start');
  return player.is_admin ? true : router.parseUrl('/');
};

// Redaktörssidan kräver att sessionen har angett en redaktörskod, annars startskärmen.
const isEditor = async () => {
  const router = inject(Router);
  const { data } = await inject(Supabase).client.rpc('editor_room');
  return data ? true : router.parseUrl('/start');
};

const adminPage = { outsideRoom: true, adminPage: true };

export const routes: Routes = [
  { path: '', component: Home, canActivate: [inRoom] },
  { path: 'aktiviteter', component: Activities, canActivate: [inRoom] },
  { path: 'aktiviteter/vem-svarade', component: WhoAnswered, canActivate: [inRoom] },
  { path: 'aktiviteter/sortera', component: Order, canActivate: [inRoom] },
  { path: 'spel', component: Game, canActivate: [inRoom] },
  { path: 'spel/:game', component: GamePlay, canActivate: [inRoom] },
  { path: 'uppdrag', component: Missions, canActivate: [inRoom] },
  { path: 'topplista', component: Leaderboard, canActivate: [inRoom] },
  { path: 'verktyg', component: AdminTools, canActivate: [adminInRoom] },
  // Utanför rummet: ingen bottenmeny och inget spelarnamn.
  { path: 'start', component: Start, data: { outsideRoom: true } },
  { path: 'redigera', component: Editor, canActivate: [isEditor], data: { outsideRoom: true } },
  { path: 'rum/:kod', component: ChoosePlayer, data: { outsideRoom: true } },
  { path: 'rum/:kod/ny', component: NewPlayer, data: { outsideRoom: true } },
  { path: 'rum/:kod/spelare/:id', component: PlayerPin, data: { outsideRoom: true } },
  // Admin: ingen bottenmeny, admins namn i headern.
  { path: 'admin/logga-in', component: AdminLogin, data: adminPage },
  { path: 'admin', component: Admin, canActivate: [isAdmin], data: adminPage },
  { path: 'admin/nytt-rum', component: AdminNewRoom, canActivate: [isAdmin], data: adminPage },
  { path: '**', redirectTo: '' },
];
