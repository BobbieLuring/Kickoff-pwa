import { GameRules } from './game-rules';
import { Pricka } from './pricka';
import { Flyg } from './flyg';
import { Plattor } from './plattor';

export interface GameInfo {
  key: string;
  title: string;
  description: string;
  create: () => GameRules;
}

/** Spelen, i ordning. `key` är nyckeln i tabellen sections och i game_scores. */
export const GAMES: GameInfo[] = [
  {
    key: 'flyg',
    title: 'Flyg',
    description: 'Tryck för att flyga genom luckorna.',
    create: () => new Flyg(),
  },
  {
    key: 'pricka',
    title: 'Pricka',
    description: 'Tryck när markören är i den orange zonen.',
    create: () => new Pricka(),
  },
  {
    key: 'plattor',
    title: 'Plattor',
    description: 'Tryck på plattorna innan de når botten.',
    create: () => new Plattor(),
  },
];