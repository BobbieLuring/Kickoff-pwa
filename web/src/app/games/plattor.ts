import { GAME_H, GAME_W, GameColors, GameRules } from './game-rules';

const COLUMNS = 4;
const COL_W = GAME_W / COLUMNS;
const ROW_H = 100;
const START_SPEED = 2.2;
const SPEED_UP = 0.08;

interface Row {
  y: number;
  /** Kolumnen med den mörka plattan. */
  col: number;
  hit: boolean;
}

/** Tryck på den mörka plattan i varje rad innan den når botten. Fel ställe eller missad platta: slut. */
export class Plattor implements GameRules {
  readonly startTapCounts = false;

  score = 0;
  over = false;

  private rows: Row[] = [];
  private speed = START_SPEED;

  reset() {
    this.score = 0;
    this.over = false;
    this.rows = [];
    this.speed = START_SPEED;
  }

  step() {
    // En ny rad så fort den förra har kommit in helt på skärmen, så att raderna ligger tätt.
    const last = this.rows.at(-1);
    if (!last || last.y > 0) {
      this.rows.push({ y: -ROW_H, col: Math.floor(Math.random() * COLUMNS), hit: false });
    }

    for (const row of this.rows) row.y += this.speed;

    if (this.rows.some((r) => !r.hit && r.y > GAME_H)) this.over = true;
    this.rows = this.rows.filter((r) => r.y < GAME_H + ROW_H);
  }

  tap(x: number, y: number) {
    const col = Math.floor(x / COL_W);
    const row = this.rows.find((r) => !r.hit && y >= r.y && y <= r.y + ROW_H);
    if (row && row.col === col) {
      row.hit = true;
      this.score++;
      this.speed += SPEED_UP;
    } else {
      this.over = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, colors: GameColors) {
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    for (let i = 1; i < COLUMNS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * COL_W, 0);
      ctx.lineTo(i * COL_W, GAME_H);
      ctx.stroke();
    }

    for (const row of this.rows) {
      ctx.fillStyle = row.hit ? colors.line : colors.text;
      ctx.fillRect(row.col * COL_W + 2, row.y + 2, COL_W - 4, ROW_H - 4);
    }
  }
}