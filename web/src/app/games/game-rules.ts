/** Spelplanens storlek i spelenheter. Skalas till skärmen av GameCanvas. */
export const GAME_W = 320;
export const GAME_H = 420;

/** Färgerna från appens tema, så att spelen följer ljust och mörkt läge. */
export interface GameColors {
  text: string;
  muted: string;
  line: string;
  accent: string;
}

/** Det ett spel måste kunna. Ramen (GameCanvas) sköter loop, tryck, start- och slutskärm. */
export interface GameRules {
  /** Om trycket som startar spelet också ska räknas som ett drag (t.ex. ett vingslag i Flyg). */
  readonly startTapCounts: boolean;
  reset(): void;
  /** Ett steg i spelet, körs 60 gånger per sekund medan det pågår. */
  step(): void;
  /** Ett tryck på spelplanen, i spelenheter. */
  tap(x: number, y: number): void;
  draw(ctx: CanvasRenderingContext2D, colors: GameColors): void;
  readonly score: number;
  readonly over: boolean;
}