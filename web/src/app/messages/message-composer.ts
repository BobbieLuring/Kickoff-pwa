import { Injectable, signal } from '@angular/core';

export interface MessageTarget {
  id: string;
  name: string;
}

/** Vem "Meddelande till …"-rutan är öppen för. Öppnas från topplistan eller genom att trycka på en bubbla. */
@Injectable({ providedIn: 'root' })
export class MessageComposer {
  readonly target = signal<MessageTarget | null>(null);

  open(id: string, name: string) {
    this.target.set({ id, name });
  }

  close() {
    this.target.set(null);
  }
}
