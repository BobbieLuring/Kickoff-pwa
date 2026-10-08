import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { GAME_H, GAME_W, GameColors, GameRules } from '../game-rules';

const STEP_MS = 1000 / 60;

/** Ramen alla spel delar: canvas, spelloop, tryck, poäng, start- och slutskärm. */
@Component({
  selector: 'app-game-canvas',
  templateUrl: './game-canvas.html',
  styleUrl: './game-canvas.scss',
})
export class GameCanvas {
  readonly rules = input.required<GameRules>();
  /** Skickas en gång när en omgång tar slut, med poängen. */
  readonly finished = output<number>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private state: 'idle' | 'run' | 'over' = 'idle';
  private colors!: GameColors;
  private destroyed = false;

  constructor() {
    // Nytt spel: börja om från startskärmen.
    effect(() => {
      this.rules().reset();
      this.state = 'idle';
    });

    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const resize = () => {
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(canvas.clientWidth * ratio);
        canvas.height = Math.round(canvas.clientHeight * ratio);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      // iOS gör snabba tryck till egna gester (dubbeltryck som scrollar sidan) även med
      // touch-action: none. preventDefault på själva touch-händelserna stoppar det; spelet får
      // ändå sina tryck via pointerdown. Måste registreras som "passive: false" för att få stoppa.
      const stopGesture = (event: Event) => event.preventDefault();
      const options = { passive: false };
      canvas.addEventListener('touchstart', stopGesture, options);
      canvas.addEventListener('touchmove', stopGesture, options);
      canvas.addEventListener('touchend', stopGesture, options);
      canvas.addEventListener('dblclick', stopGesture);

      this.readColors();
      this.loop(canvas);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        canvas.removeEventListener('touchstart', stopGesture);
        canvas.removeEventListener('touchmove', stopGesture);
        canvas.removeEventListener('touchend', stopGesture);
        canvas.removeEventListener('dblclick', stopGesture);
      });
    });

    this.destroyRef.onDestroy(() => (this.destroyed = true));
  }

  private readonly destroyRef = inject(DestroyRef);

  protected onPointerDown(event: PointerEvent) {
    event.preventDefault();
    const rules = this.rules();

    if (this.state === 'over') {
      rules.reset();
      this.readColors();
      this.state = 'idle';
      return;
    }

    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * GAME_W) / rect.width;
    const y = ((event.clientY - rect.top) * GAME_H) / rect.height;

    if (this.state === 'idle') {
      this.state = 'run';
      if (!rules.startTapCounts) return;
    }
    rules.tap(x, y);
    this.checkOver();
  }

  private loop(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      if (this.destroyed) return;
      // Fast steglängd så att spelet går lika fort på alla telefoner. Högst 5 steg i taget,
      // så att det inte rusar iväg efter att appen legat i bakgrunden.
      acc = Math.min(acc + (now - last), STEP_MS * 5);
      last = now;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        if (this.state === 'run') {
          this.rules().step();
          this.checkOver();
        }
      }
      this.draw(ctx, canvas);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private checkOver() {
    if (this.state === 'run' && this.rules().over) {
      this.state = 'over';
      this.finished.emit(this.rules().score);
    }
  }

  private draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const scale = canvas.width / GAME_W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    this.rules().draw(ctx, this.colors);

    ctx.fillStyle = this.colors.text;
    ctx.textAlign = 'center';
    ctx.font = '800 40px "Big Shoulders Display", "Arial Narrow", sans-serif';
    ctx.fillText(String(this.rules().score), GAME_W / 2, 52);

    if (this.state !== 'run') {
      ctx.fillStyle = this.colors.muted;
      ctx.font = '15px "Familjen Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(
        this.state === 'idle' ? 'Tryck för att börja' : 'Slut! Tryck för att spela igen',
        GAME_W / 2,
        GAME_H - 28,
      );
    }
  }

  /** Läser appens färger, så att spelet följer ljust och mörkt läge. */
  private readColors() {
    const style = getComputedStyle(document.documentElement);
    const v = (name: string) => style.getPropertyValue(name).trim();
    this.colors = { text: v('--text'), muted: v('--text-muted'), line: v('--line'), accent: v('--accent') };
  }
}