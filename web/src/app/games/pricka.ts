import { GAME_H, GAME_W, GameColors, GameRules } from './game-rules';

const ZONE = 40;
const MIN = 14;
const MAX = GAME_W - 14;
const START_SPEED = 2.2;
const SPEED_UP = 0.4;

/** Tryck när markören är i zonen. Varje träff flyttar zonen och gör markören snabbare. */
export class Pricka implements GameRules {
  readonly startTapCounts = false;

  score = 0;
  over = false;

  private pos = MIN;
  private dir = 1;
  private speed = START_SPEED;
  private zone = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.over = false;
    this.pos = MIN;
    this.dir = 1;
    this.speed = START_SPEED;
    this.zone = this.newZone(this.pos);
  }

  step() {
    this.pos += this.dir * this.speed;
    if (this.pos > MAX) {
      this.pos = MAX;
      this.dir = -1;
    }
    if (this.pos < MIN) {
      this.pos = MIN;
      this.dir = 1;
    }
  }

  tap() {
    if (Math.abs(this.pos - this.zone) <= ZONE / 2) {
      this.score++;
      this.speed += SPEED_UP;
      this.zone = this.newZone(this.pos);
    } else {
      this.over = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, colors: GameColors) {
    const y = GAME_H / 2;
    ctx.fillStyle = colors.line;
    ctx.fillRect(MIN, y - 4, MAX - MIN, 8);

    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(this.zone - ZONE / 2, y - 26, ZONE, 52);
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.text;
    ctx.fillRect(this.pos - 3, y - 34, 6, 68);
  }

  /** Ny zon någonstans på linjen, men aldrig precis där markören är. */
  private newZone(avoid: number): number {
    let center: number;
    do {
      center = MIN + ZONE / 2 + Math.random() * (MAX - MIN - ZONE);
    } while (Math.abs(center - avoid) < ZONE * 1.5);
    return center;
  }
}