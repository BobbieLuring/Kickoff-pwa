import { afterNextRender, Component, ElementRef, input, model, signal, viewChildren } from '@angular/core';

const LENGTH = 4;

/** Fyra rutor för en PIN-kod. Fokus hoppar framåt vid inmatning och bakåt vid Backspace. */
@Component({
  selector: 'app-pin-input',
  templateUrl: './pin-input.html',
  styleUrl: './pin-input.scss',
})
export class PinInput {
  /** Siffrorna hittills; komplett när längden är 4. */
  readonly value = model('');
  readonly label = input('PIN-kod');

  /** Put focus in the first box when the component is shown. */
  readonly focusOnLoad = input(false);

  constructor() {
    afterNextRender(() => {
      if (this.focusOnLoad()) this.boxes()[0]?.nativeElement.focus();
    });
  }

  protected readonly digits = signal<string[]>(Array(LENGTH).fill(''));
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  /** Tömmer rutorna och sätter fokus på den första, t.ex. efter fel PIN. */
  clear() {
    this.digits.set(Array(LENGTH).fill(''));
    this.value.set('');
    this.boxes()[0]?.nativeElement.focus();
  }

  protected onInput(index: number, event: Event) {
    const box = event.target as HTMLInputElement;
    const digit = box.value.replace(/\D/g, '').slice(-1);
    box.value = digit;
    this.digits.update((d) => d.map((v, i) => (i === index ? digit : v)));
    this.value.set(this.digits().join(''));
    if (digit && index < LENGTH - 1) this.boxes()[index + 1].nativeElement.focus();
  }

  protected onKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.boxes()[index - 1].nativeElement.focus();
    }
  }
}
