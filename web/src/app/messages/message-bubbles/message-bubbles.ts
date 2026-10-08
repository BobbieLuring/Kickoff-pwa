import { Component, inject } from '@angular/core';
import { MessageComposer } from '../message-composer';
import { IncomingMessage, Messages } from '../messages';

/** Inkomna meddelanden som bubblor nerifrån. Tryck på en bubbla för att svara. */
@Component({
  selector: 'app-message-bubbles',
  templateUrl: './message-bubbles.html',
  styleUrl: './message-bubbles.scss',
})
export class MessageBubbles {
  protected readonly messages = inject(Messages);
  private readonly composer = inject(MessageComposer);

  protected reply(message: IncomingMessage) {
    this.messages.dismiss(message.id);
    this.composer.open(message.sender_id, message.sender_name);
  }
}
