import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { WhoAnswered } from './pages/who-answered/who-answered';
import { Game } from './pages/game/game';
import { Missions } from './pages/missions/missions';
import { Leaderboard } from './pages/leaderboard/leaderboard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'svara', component: WhoAnswered },
  { path: 'spel', component: Game },
  { path: 'uppdrag', component: Missions },
  { path: 'topplista', component: Leaderboard },
  { path: '**', redirectTo: '' },
];