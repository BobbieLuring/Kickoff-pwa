import { GAME_H, GAME_W, GameColors, GameRules } from './game-rules';

const BIRD_X = 75;
const BIRD_R = 12;
const GRAVITY = 0.38;
const FLAP = -6.2;
const PIPE_W = 50;
const GAP = 130;
const SPACING = 210;
const START_SPEED = 2.3;
const SPEED_UP = 0.12;

interface Pipe {
  x: number;
  /** Överkanten på luckan. */
  gap: number;
  passed: boolean;
}

/** Tryck för att flyga uppåt genom luckorna. Det går lite fortare för varje lucka. */
export class Flyg implements GameRules {
  readonly startTapCounts = true;

  score = 0;
  over = false;

  private y = GAME_H / 2;
  private velocity = 0;
  private speed = START_SPEED;
  private pipes: Pipe[] = [];

  reset() {
    this.score = 0;
    this.over = false;
    this.y = GAME_H / 2;
    this.velocity = 0;
    this.speed = START_SPEED;
    this.pipes = [];
  }

  step() {
    this.velocity += GRAVITY;
    this.y += this.velocity;

    // Nya hinder kommer på fast avstånd, inte fast tid, så att de inte klumpar ihop sig när farten ökar.
    const last = this.pipes.at(-1);
    if (!last || last.x < GAME_W - SPACING) {
      this.pipes.push({ x: GAME_W, gap: 90 + Math.random() * (GAME_H - 240), passed: false });
    }

    for (const pipe of this.pipes) {
      pipe.x -= this.speed;
      if (!pipe.passed && pipe.x + PIPE_W < BIRD_X - BIRD_R) {
        pipe.passed = true;
        this.score++;
        this.speed += SPEED_UP;
      }
      const overlapsX = pipe.x < BIRD_X + BIRD_R && pipe.x + PIPE_W > BIRD_X - BIRD_R;
      const outsideGap = this.y - BIRD_R < pipe.gap || this.y + BIRD_R > pipe.gap + GAP;
      if (overlapsX && outsideGap) this.over = true;
    }
    this.pipes = this.pipes.filter((p) => p.x > -PIPE_W);

    if (this.y > GAME_H - BIRD_R || this.y < BIRD_R) this.over = true;
  }

  tap() {
    this.velocity = FLAP;
  }

  draw(ctx: CanvasRenderingContext2D, colors: GameColors) {
    ctx.fillStyle = colors.line;
    for (const pipe of this.pipes) {
      ctx.fillRect(pipe.x, 0, PIPE_W, pipe.gap);
      ctx.fillRect(pipe.x, pipe.gap + GAP, PIPE_W, GAME_H - pipe.gap - GAP);
    }

    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(BIRD_X, this.y, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
  }
}