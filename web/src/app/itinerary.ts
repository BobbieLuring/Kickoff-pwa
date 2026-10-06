import { GAMES } from './games/games';

/** Ett stopp på resplanen. `keys` är nycklarna i tabellen sections; flera nycklar slås ihop. */
export interface Stop {
  keys: string[];
  title: string;
  path: string;
  /** Kort text när stoppet är öppet. */
  openText: string;
}

/** Resplanens stopp, i ordning. Används av Hem ("Nästa stopp") och Resplan. */
export const STOPS: Stop[] = [
  {
    keys: ['who'],
    title: 'Vem svarade?',
    path: '/aktiviteter/vem-svarade',
    openText: 'Gissa vem som skrev vad',
  },
  {
    keys: ['order'],
    title: 'Sortera',
    path: '/aktiviteter/sortera',
    openText: 'Sätt kollegorna i rätt ordning',
  },
  {
    keys: GAMES.map((g) => g.key),
    title: 'Spel',
    path: '/spel',
    openText: 'Jaga highscore',
  },
  {
    keys: ['missions'],
    title: 'Uppdrag',
    path: '/uppdrag',
    openText: 'Ditt hemliga uppdrag väntar',
  },
];

/** Texter för stopp som inte har öppnat än. Varieras så att listan inte säger samma sak överallt. */
export const SOON_TEXTS = ['Väntar på att Johannes ska komma in', 'Snart', 'Robert sover', 'Caj ska bara på toa först', 'Martin sitter i möte', 'Jonas vabbar', 'Palm vabbar', 'Mattias äter yogurt', 'Hampus går med hunden'];
