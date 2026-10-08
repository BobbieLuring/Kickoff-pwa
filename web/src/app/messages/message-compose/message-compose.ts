import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MessageComposer } from '../message-composer';
import { Messages } from '../messages';

const MAX_LENGTH = 40;

/** "Meddelande till Anna": en ruta nerifrån med ett textfält och Skicka. */
@Component({
  selector: 'app-message-compose',
  templateUrl: './message-compose.html',
  styleUrl: './message-compose.scss',
})
export class MessageCompose {
  protected readonly composer = inject(MessageComposer);
  private readonly messages = inject(Messages);
  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');

  protected readonly maxLength = MAX_LENGTH;
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Ny mottagare: börja om med ett tomt fält och sätt fokus i det.
    effect(() => {
      if (!this.composer.target()) return;
      this.text.set('');
      this.error.set('');
      setTimeout(() => this.field()?.nativeElement.focus());
    });
  }

  protected close() {
    this.composer.close();
  }

  protected async send() {
    const target = this.composer.target();
    const text = this.text().trim();
    if (!target || !text) return;

    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.messages.send(target.id, text);
      if (result.ok) {
        this.composer.close();
      } else if (result.error === 'too_fast') {
        this.error.set(`Lugn i stormen. Vänta ${result.wait_seconds ?? 10} sekunder.`);
      } else if (result.error === 'invalid_text') {
        this.error.set(`Meddelandet måste vara 1–${MAX_LENGTH} tecken.`);
      } else {
        this.error.set('Kunde inte skicka. Försök igen.');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
